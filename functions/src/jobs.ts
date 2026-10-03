import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

import { FAL_KEY, REPLICATE_TOKEN } from './lib/config';
import { decideCharge, FREE_TRIAL_CREDITS, refundOf, UserCredits } from './lib/credits';
import { Moderator } from './lib/moderation';
import { buildPrompt, isTemplateActive, TemplateDoc } from './lib/prompt';
import { loadRuntime, recordCost } from './lib/runtime';
import { generateWithFallback, makeProvider, resolveModel } from './providers';
import { referralCode } from './referrals';

const ASPECTS = new Set(['9:16', '4:5', '1:1']);

function creditsOf(d: FirebaseFirestore.DocumentData | undefined): UserCredits {
  return {
    credits: (d?.credits as number) ?? 0,
    proUntil: (d?.pro_until as Timestamp | undefined)?.toMillis() ?? null,
    proUsedWeek: (d?.pro_used_week as number) ?? 0,
    proWeekStart: (d?.pro_week_start as Timestamp | undefined)?.toMillis() ?? null,
  };
}

/**
 * Validates, rate-limits and charges credits atomically, then queues the job.
 * Credits are always deducted BEFORE any AI call (cost guard).
 */
export const createGenerationJob = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: false },
  async (req: CallableRequest<{ templateId: string; selfiePaths: string[]; gender: string; aspectRatio: string; variations?: number; fcmToken?: string }>) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'يرجى تسجيل الدخول');
    const { templateId, selfiePaths, gender, aspectRatio } = req.data ?? {};
    if (typeof templateId !== 'string' || !Array.isArray(selfiePaths) || selfiePaths.length < 1 || selfiePaths.length > 3) {
      throw new HttpsError('invalid-argument', 'بيانات غير صحيحة');
    }
    if (!selfiePaths.every((p) => typeof p === 'string' && p.startsWith(`uploads/${uid}/`))) {
      throw new HttpsError('permission-denied', 'مسار صورة غير مسموح');
    }
    const aspect = ASPECTS.has(aspectRatio) ? aspectRatio : '9:16';
    const cfg = await loadRuntime();
    if (cfg.killSwitch) throw new HttpsError('unavailable', 'الخدمة متوقفة مؤقتاً للصيانة، حاول بعد قليل');

    const db = getFirestore();
    const tSnap = await db.doc(`templates/${templateId}`).get();
    const template = tSnap.data() as TemplateDoc | undefined;
    if (!template || !isTemplateActive(template, new Date())) throw new HttpsError('not-found', 'القالب غير متاح حالياً');

    const since = Timestamp.fromMillis(Date.now() - 3600_000);
    const recent = await db.collection('jobs').where('uid', '==', uid).where('created_at', '>', since).count().get();
    if (recent.data().count >= cfg.jobsPerHourPerUser) {
      throw new HttpsError('resource-exhausted', 'طلبات كثيرة، حاول بعد قليل', { reason: 'rate_limited' });
    }

    const cost = template.credits_cost ?? 1;
    const userRef = db.doc(`users/${uid}`);
    const jobRef = db.collection('jobs').doc();
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        // First use: create the account with the free trial grant.
        tx.set(userRef, { credits: FREE_TRIAL_CREDITS, referral_code: referralCode(uid), created_at: FieldValue.serverTimestamp() });
        tx.set(db.collection('transactions').doc(), {
          uid, type: 'signupBonus', amount: FREE_TRIAL_CREDITS, created_at: FieldValue.serverTimestamp(),
        });
      }
      const u = userSnap.exists ? creditsOf(userSnap.data()) : { credits: FREE_TRIAL_CREDITS, proUntil: null, proUsedWeek: 0, proWeekStart: null };
      const isPro = u.proUntil !== null && u.proUntil > Date.now();
      if (template.is_premium && !isPro) throw new HttpsError('permission-denied', 'هذا القالب مميز ومتاح لمشتركي Pro');
      const decision = decideCharge(u, cost, Date.now());
      if (!decision.ok) {
        throw new HttpsError('resource-exhausted', 'رصيدك غير كافٍ', { reason: decision.reason === 'insufficient_credits' ? 'insufficient_credits' : 'fair_use' });
      }
      tx.set(userRef, {
        credits: decision.next.credits,
        pro_used_week: decision.next.proUsedWeek,
        pro_week_start: decision.next.proWeekStart ? Timestamp.fromMillis(decision.next.proWeekStart) : null,
        ...(typeof req.data.fcmToken === 'string' ? { fcm_token: req.data.fcmToken } : {}),
      }, { merge: true });
      tx.set(db.collection('transactions').doc(), {
        uid, type: 'generation', amount: decision.mode === 'pro' ? 0 : -cost, job_id: jobRef.id,
        note: decision.mode === 'pro' ? 'pro' : '', created_at: FieldValue.serverTimestamp(),
      });
      tx.set(jobRef, {
        uid,
        template_id: templateId,
        selfie_paths: selfiePaths,
        gender: gender === 'female' ? 'female' : 'male',
        aspect_ratio: aspect,
        variations: Math.min(Math.max(req.data.variations ?? cfg.variations, 1), 4),
        status: 'queued',
        progress: 0,
        cost,
        charge_mode: decision.mode,
        watermarked: decision.watermarked,
        priority: decision.mode === 'pro',
        created_at: FieldValue.serverTimestamp(),
      });
    });
    return { jobId: jobRef.id };
  },
);

async function refund(jobId: string, uid: string, mode: 'pro' | 'credits', cost: number): Promise<void> {
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const jobRef = db.doc(`jobs/${jobId}`);
  await db.runTransaction(async (tx) => {
    const job = await tx.get(jobRef);
    if (job.data()?.refunded) return; // exactly once
    const u = creditsOf((await tx.get(userRef)).data());
    const next = refundOf(u, mode, cost);
    tx.set(userRef, { credits: next.credits, pro_used_week: next.proUsedWeek }, { merge: true });
    tx.update(jobRef, { refunded: true });
    tx.set(db.collection('transactions').doc(), {
      uid, type: 'refund', amount: mode === 'pro' ? 0 : cost, job_id: jobId, created_at: FieldValue.serverTimestamp(),
    });
  });
}

async function notify(uid: string, title: string, body: string, jobId: string): Promise<void> {
  const token = (await getFirestore().doc(`users/${uid}`).get()).data()?.fcm_token as string | undefined;
  if (!token) return;
  try {
    await getMessaging().send({ token, notification: { title, body }, data: { jobId } });
  } catch (e) {
    logger.warn('FCM send failed', e);
  }
}

export const processJob = onDocumentCreated(
  { document: 'jobs/{jobId}', secrets: [FAL_KEY, REPLICATE_TOKEN], timeoutSeconds: 300, memory: '1GiB' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    const jobId = event.params.jobId;
    const ref = snap.ref;
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const started = Date.now();
    const cfg = await loadRuntime();
    try {
      await ref.update({ status: 'processing', progress: 0.1 });
      const template = (await db.doc(`templates/${job.template_id}`).get()).data() as TemplateDoc;

      // 1. Signed URLs for the selfies (15 minutes).
      const selfieUrls = await Promise.all(
        (job.selfie_paths as string[]).map(async (p) =>
          (await bucket.file(p).getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60_000 }))[0]),
      );

      // 2. Input moderation.
      const moderator = new Moderator(FAL_KEY.value() || undefined);
      for (const u of selfieUrls) {
        const m = await moderator.check(u);
        if (!m.allowed) throw Object.assign(new Error('input_rejected'), { userMessage: 'الصورة المرفوعة غير مناسبة. استخدم صورة سيلفي عادية لك.' });
      }
      await ref.update({ progress: 0.25 });

      // 3-4. Prompt + provider with retries and fallback.
      const { prompt, negative } = buildPrompt(template, job.gender);
      const keys = { fal: FAL_KEY.value() || undefined, replicate: REPLICATE_TOKEN.value() || undefined };
      const result = await generateWithFallback(
        {
          selfieUrls,
          prompt,
          negativePrompt: negative,
          model: resolveModel(cfg, template.model_id),
          aspectRatio: job.aspect_ratio,
          count: job.variations,
          styleStrength: template.style_strength ?? 0.8,
          timeoutMs: cfg.providerTimeoutMs,
        },
        makeProvider(cfg.primaryProvider, keys),
        cfg.fallbackProvider === 'none' ? null : makeProvider(cfg.fallbackProvider, keys),
      );
      await recordCost(result.costUsd, cfg);
      await ref.update({ progress: 0.75, provider: result.provider, cost_usd: result.costUsd });

      // 5-6. Output moderation, then persist to Storage.
      const paths: string[] = [];
      for (const [i, img] of result.images.entries()) {
        if (img.flaggedNsfw) continue;
        if (!(await moderator.check(img.url)).allowed) continue;
        const res = await fetch(img.url);
        if (!res.ok) continue;
        const path = `results/${job.uid}/${jobId}/${i}.png`;
        await bucket.file(path).save(Buffer.from(await res.arrayBuffer()), { contentType: 'image/png', resumable: false });
        paths.push(path);
      }
      if (!paths.length) throw Object.assign(new Error('all_outputs_filtered'), { userMessage: 'لم نتمكن من إنشاء صور مناسبة هذه المرة. أُعيد رصيدك.' });

      // 7-8. Done + push.
      await ref.update({
        status: 'done',
        progress: 1,
        result_paths: paths,
        duration_ms: Date.now() - started,
        finished_at: FieldValue.serverTimestamp(),
      });
      await notify(job.uid, 'صورك جاهزة ✨', 'افتح التطبيق وأضف اسمك وتهنئتك', jobId);
    } catch (e) {
      // 9. Failure: mark failed and refund automatically.
      logger.error('job failed', { jobId, error: String(e) });
      const userMessage = (e as { userMessage?: string }).userMessage ?? 'تعذّر إنشاء الصور. أُعيد رصيدك تلقائياً.';
      await ref.update({ status: 'failed', error_ar: userMessage, error: String(e), duration_ms: Date.now() - started });
      await refund(jobId, job.uid, job.charge_mode, job.cost);
      await notify(job.uid, 'لم تكتمل صورك', 'أُعيد رصيدك تلقائياً، جرّب مرة أخرى', jobId);
    }
  },
);
