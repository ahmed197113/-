import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

import { DEFAULT_RUNTIME, RuntimeConfig } from './lib/config';
import { today } from './lib/runtime';

function requireAdmin(req: CallableRequest): string {
  if (!req.auth?.uid || req.auth.token.admin !== true) throw new HttpsError('permission-denied', 'admin only');
  return req.auth.uid;
}

/** Create/update a template; seasonal packs go live with no app update. */
export const adminUpsertTemplate = onCall(async (req) => {
  const admin = requireAdmin(req);
  const t = req.data as Record<string, unknown> & { id?: string };
  if (!t?.id || typeof t.title_ar !== 'string' || typeof t.prompt_template !== 'string') {
    throw new HttpsError('invalid-argument', 'id, title_ar and prompt_template are required');
  }
  const { id, ...rest } = t;
  await getFirestore().doc(`templates/${id}`).set({ ...rest, updated_by: admin, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const adminGrantCredits = onCall(async (req) => {
  const admin = requireAdmin(req);
  const { uid, amount, note } = req.data as { uid: string; amount: number; note?: string };
  if (!uid || !Number.isInteger(amount) || amount === 0) throw new HttpsError('invalid-argument', 'uid and non-zero integer amount required');
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`users/${uid}`);
    const cur = ((await tx.get(ref)).data()?.credits as number | undefined) ?? 0;
    if (cur + amount < 0) throw new HttpsError('failed-precondition', 'balance would go negative');
    tx.set(ref, { credits: cur + amount }, { merge: true });
    tx.set(db.collection('transactions').doc(), {
      uid, type: amount > 0 ? 'adminGrant' : 'adminDeduct', amount, note: note ?? '', by: admin, created_at: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

export const adminSetConfig = onCall(async (req) => {
  requireAdmin(req);
  const allowed = Object.keys(DEFAULT_RUNTIME);
  const patch = Object.fromEntries(Object.entries(req.data ?? {}).filter(([k]) => allowed.includes(k))) as Partial<RuntimeConfig>;
  await getFirestore().doc('config/runtime').set(patch, { merge: true });
  return { ok: true, applied: Object.keys(patch) };
});

/** Dashboard numbers for the last 24h. */
export const adminMetrics = onCall(async (req) => {
  requireAdmin(req);
  const db = getFirestore();
  const since = Timestamp.fromMillis(Date.now() - 24 * 3600_000);
  const jobs = await db.collection('jobs').where('created_at', '>', since).get();
  let done = 0, failed = 0, durations = 0;
  const perTemplate: Record<string, number> = {};
  for (const d of jobs.docs) {
    const j = d.data();
    if (j.status === 'done') { done++; durations += j.duration_ms ?? 0; }
    if (j.status === 'failed') failed++;
    perTemplate[j.template_id] = (perTemplate[j.template_id] ?? 0) + 1;
  }
  const cost = (await db.doc(`costs/${today()}`).get()).data()?.usd ?? 0;
  return {
    jobs: jobs.size,
    done,
    failed,
    successRate: jobs.size ? done / jobs.size : null,
    avgDurationMs: done ? Math.round(durations / done) : null,
    aiCostTodayUsd: cost,
    topTemplates: Object.entries(perTemplate).sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
});
