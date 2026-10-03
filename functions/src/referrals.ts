import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { REFERRAL_REWARD } from './lib/credits';

export function referralCode(uid: string): string {
  const base = uid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return base.length >= 6 ? base.slice(0, 6) : base.padEnd(6, 'X');
}

/**
 * Called by the invitee after their first successful generation. Both sides
 * get credits; one reward per device and per invitee (anti-fraud).
 */
export const redeemReferral = onCall({ enforceAppCheck: true }, async (req) => {
  const uid = req.auth?.uid;
  const { code, deviceId } = (req.data ?? {}) as { code?: string; deviceId?: string };
  if (!uid) throw new HttpsError('unauthenticated', 'يرجى تسجيل الدخول');
  if (!code || !deviceId) throw new HttpsError('invalid-argument', 'رمز غير صحيح');
  const db = getFirestore();
  const referrer = await db.collection('users').where('referral_code', '==', code.toUpperCase()).limit(1).get();
  if (referrer.empty) throw new HttpsError('not-found', 'رمز الدعوة غير موجود');
  const referrerUid = referrer.docs[0].id;
  if (referrerUid === uid) throw new HttpsError('failed-precondition', 'لا يمكنك استخدام رمزك');

  const doneJobs = await db.collection('jobs').where('uid', '==', uid).where('status', '==', 'done').limit(1).get();
  if (doneJobs.empty) throw new HttpsError('failed-precondition', 'أنشئ أول صورة لك ثم استخدم الرمز');

  await db.runTransaction(async (tx) => {
    const deviceRef = db.doc(`referrals/device_${deviceId}`);
    const inviteeRef = db.doc(`referrals/invitee_${uid}`);
    const [device, invitee] = await Promise.all([tx.get(deviceRef), tx.get(inviteeRef)]);
    if (device.exists || invitee.exists) throw new HttpsError('already-exists', 'استُخدمت مكافأة الدعوة على هذا الجهاز');
    const record = { referrer: referrerUid, invitee: uid, device: deviceId, created_at: FieldValue.serverTimestamp() };
    tx.set(deviceRef, record);
    tx.set(inviteeRef, record);
    for (const u of [uid, referrerUid]) {
      tx.set(db.doc(`users/${u}`), { credits: FieldValue.increment(REFERRAL_REWARD) }, { merge: true });
      tx.set(db.collection('transactions').doc(), { uid: u, type: 'referral', amount: REFERRAL_REWARD, created_at: FieldValue.serverTimestamp() });
    }
  });
  return { ok: true, reward: REFERRAL_REWARD };
});
