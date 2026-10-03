import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideCharge, PRO_WEEKLY_FAIR_USE, refundOf } from '../src/lib/credits';

const now = Date.UTC(2026, 9, 3);
const base = { credits: 2, proUntil: null, proUsedWeek: 0, proWeekStart: null };

test('charges credits and watermarks free output', () => {
  const d = decideCharge(base, 1, now);
  assert.ok(d.ok);
  if (d.ok) {
    assert.equal(d.next.credits, 1);
    assert.equal(d.watermarked, true);
  }
});

test('never goes negative', () => {
  assert.deepEqual(decideCharge({ ...base, credits: 0 }, 1, now), { ok: false, reason: 'insufficient_credits' });
});

test('pro uses fair-use quota, not credits', () => {
  const pro = { ...base, credits: 0, proUntil: now + 1000, proUsedWeek: PRO_WEEKLY_FAIR_USE - 1, proWeekStart: now - 1000 };
  const d = decideCharge(pro, 1, now);
  assert.ok(d.ok && d.mode === 'pro' && !d.watermarked && d.next.credits === 0);
  assert.equal(decideCharge({ ...pro, proUsedWeek: PRO_WEEKLY_FAIR_USE }, 1, now).ok, false);
});

test('pro week resets after 7 days', () => {
  const pro = { ...base, proUntil: now + 1000, proUsedWeek: PRO_WEEKLY_FAIR_USE, proWeekStart: now - 8 * 864e5 };
  const d = decideCharge(pro, 1, now);
  assert.ok(d.ok && d.next.proUsedWeek === 1);
});

test('refund restores the balance', () => {
  const d = decideCharge(base, 1, now);
  assert.ok(d.ok);
  if (d.ok) assert.equal(refundOf(d.next, 'credits', 1).credits, 2);
});

test('rejects invalid cost', () => {
  assert.throws(() => decideCharge(base, 0, now));
});
