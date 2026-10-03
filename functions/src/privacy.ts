import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const HOUR = 3600_000;
export const SELFIE_TTL_MS = 24 * HOUR;
export const RESULT_TTL_MS = 30 * 24 * HOUR;

/** Pure retention rule, unit-tested. */
export function isExpired(prefix: 'uploads' | 'results', createdMs: number, now: number): boolean {
  return now - createdMs >= (prefix === 'uploads' ? SELFIE_TTL_MS : RESULT_TTL_MS);
}

async function sweep(prefix: 'uploads' | 'results', now: number): Promise<number> {
  const [files] = await getStorage().bucket().getFiles({ prefix: `${prefix}/` });
  let deleted = 0;
  for (const f of files) {
    const created = Date.parse(f.metadata.timeCreated ?? '');
    if (Number.isFinite(created) && isExpired(prefix, created, now)) {
      await f.delete({ ignoreNotFound: true });
      deleted++;
    }
  }
  return deleted;
}

/** Daily: selfies after 24h, results after 30 days. (Hourly for selfies to stay well inside 24h.) */
export const scheduledCleanup = onSchedule({ schedule: 'every 1 hours', timeoutSeconds: 540 }, async () => {
  const now = Date.now();
  const uploads = await sweep('uploads', now);
  const results = await sweep('results', now);
  logger.info('cleanup', { uploads, results });
});

async function deleteUserFiles(uid: string): Promise<void> {
  const bucket = getStorage().bucket();
  await Promise.all([
    bucket.deleteFiles({ prefix: `uploads/${uid}/`, force: true }),
    bucket.deleteFiles({ prefix: `results/${uid}/`, force: true }),
  ]);
}

export const deleteMyPhotos = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يرجى تسجيل الدخول');
  await deleteUserFiles(uid);
  return { ok: true };
});

/** Full account deletion (Google Play requirement). */
export const deleteAccount = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يرجى تسجيل الدخول');
  const db = getFirestore();
  await deleteUserFiles(uid);
  for (const col of ['jobs', 'transactions', 'reports']) {
    const snap = await db.collection(col).where('uid', '==', uid).get();
    const writer = db.bulkWriter();
    snap.docs.forEach((d) => writer.delete(d.ref));
    await writer.close();
  }
  await db.doc(`users/${uid}`).delete();
  await getAuth().deleteUser(uid);
  return { ok: true };
});
