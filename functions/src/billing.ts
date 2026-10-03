import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { timingSafeEqual } from 'node:crypto';

import { REVENUECAT_WEBHOOK_SECRET } from './lib/config';
import { PRODUCT_CREDITS } from './lib/credits';

function authorized(header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * RevenueCat → server-side grants. Idempotent by RevenueCat event id, so
 * webhook retries never double-credit.
 */
export const revenuecatWebhook = onRequest({ secrets: [REVENUECAT_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST' || !authorized(req.header('authorization'), REVENUECAT_WEBHOOK_SECRET.value())) {
    res.status(401).send('unauthorized');
    return;
  }
  const ev = req.body?.event;
  if (!ev?.id || !ev?.app_user_id) {
    res.status(400).send('bad event');
    return;
  }
  const db = getFirestore();
  const eventRef = db.doc(`billing_events/${ev.id}`);
  const userRef = db.doc(`users/${ev.app_user_id}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(eventRef)).exists) return; // already processed
    tx.set(eventRef, { type: ev.type, product: ev.product_id ?? null, uid: ev.app_user_id, received_at: FieldValue.serverTimestamp() });
    const credits = PRODUCT_CREDITS[ev.product_id as string];
    switch (ev.type) {
      case 'NON_RENEWING_PURCHASE':
      case 'INITIAL_PURCHASE':
        if (credits) {
          tx.set(userRef, { credits: FieldValue.increment(credits) }, { merge: true });
          tx.set(db.collection('transactions').doc(), {
            uid: ev.app_user_id, type: 'purchase', amount: credits, rc_event: ev.id, created_at: FieldValue.serverTimestamp(),
          });
          break;
        }
      // falls through for subscriptions
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE':
        if (ev.expiration_at_ms) {
          tx.set(userRef, { pro_until: Timestamp.fromMillis(ev.expiration_at_ms), pro_used_week: 0, pro_week_start: null }, { merge: true });
          tx.set(db.collection('transactions').doc(), {
            uid: ev.app_user_id, type: 'subscription', amount: 0, rc_event: ev.id, created_at: FieldValue.serverTimestamp(),
          });
        }
        break;
      case 'EXPIRATION':
        tx.set(userRef, { pro_until: null }, { merge: true });
        break;
      case 'REFUND':
      case 'CANCELLATION':
        if (credits && ev.cancel_reason === 'CUSTOMER_SUPPORT') {
          // Claw back unused credits only; balances never go negative.
          const cur = ((await tx.get(userRef)).data()?.credits as number | undefined) ?? 0;
          tx.set(userRef, { credits: Math.max(0, cur - credits) }, { merge: true });
        }
        break;
      default:
        logger.info('ignored RevenueCat event', ev.type);
    }
  });
  res.status(200).send('ok');
});
