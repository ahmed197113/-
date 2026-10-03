import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

import { ALERT_WEBHOOK_URL, DEFAULT_RUNTIME, RuntimeConfig } from './config';

export async function loadRuntime(): Promise<RuntimeConfig> {
  const snap = await getFirestore().doc('config/runtime').get();
  return { ...DEFAULT_RUNTIME, ...(snap.data() as Partial<RuntimeConfig> | undefined) };
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Adds AI spend to today's bucket and trips the kill-switch past the cap. */
export async function recordCost(usd: number, cfg: RuntimeConfig): Promise<void> {
  const db = getFirestore();
  const ref = db.doc(`costs/${today()}`);
  const total = await db.runTransaction(async (tx) => {
    const cur = ((await tx.get(ref)).data()?.usd as number | undefined) ?? 0;
    const next = cur + usd;
    tx.set(ref, { usd: next, updated_at: new Date() }, { merge: true });
    return next;
  });
  if (total >= cfg.dailyBudgetUsd && !cfg.killSwitch) {
    await db.doc('config/runtime').set({ killSwitch: true }, { merge: true });
    await alert(`🚨 Munasaba daily AI budget reached: $${total.toFixed(2)} ≥ $${cfg.dailyBudgetUsd}. Kill-switch ON.`);
  }
}

export async function alert(text: string): Promise<void> {
  logger.error(text);
  const url = ALERT_WEBHOOK_URL.value();
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch (e) {
    logger.error('alert webhook failed', e);
  }
}
