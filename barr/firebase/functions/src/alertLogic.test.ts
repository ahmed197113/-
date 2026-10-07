import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkinAlert, crossedNow, dailyCounts, isDueOn, localNow, newlyMissedDoses, MedicationDoc,
} from "./alertLogic";

const now = (minutes: number, day = "20260310", weekday = 2) => ({ day, weekday, minutes });
const med: MedicationDoc = { id: "m1", name: "Med", times: ["0800", "2000"], startDate: "20260101" };

test("localNow converts to the parent's timezone", () => {
  // 2026-03-10 05:07 UTC = 08:07 in Riyadh (UTC+3), Tuesday.
  const n = localNow(new Date(Date.UTC(2026, 2, 10, 5, 7)), "Asia/Riyadh");
  assert.deepEqual(n, { day: "20260310", weekday: 2, minutes: 8 * 60 + 7 });
});

test("each rule fires in exactly one 5-minute run", () => {
  assert.equal(crossedNow(510, 510), true);
  assert.equal(crossedNow(510, 514), true);
  assert.equal(crossedNow(510, 515), false);
  assert.equal(crossedNow(510, 509), false);
});

test("missed doses are reported 30 minutes after their time", () => {
  assert.deepEqual(newlyMissedDoses([med], new Set(), now(8 * 60 + 29)), []);
  const missed = newlyMissedDoses([med], new Set(), now(8 * 60 + 31));
  assert.deepEqual(missed.map((d) => d.doseId), ["20260310_m1_0800"]);
  assert.deepEqual(newlyMissedDoses([med], new Set(["20260310_m1_0800"]), now(8 * 60 + 31)), []);
});

test("weekday and date ranges are respected", () => {
  assert.equal(isDueOn({ ...med, weekdays: [5] }, now(0)), false);
  assert.equal(isDueOn({ ...med, endDate: "20260309" }, now(0)), false);
  assert.equal(isDueOn({ ...med, active: false }, now(0)), false);
});

test("check-in alert then escalation two hours later", () => {
  assert.equal(checkinAlert("10:00", false, now(600)), "first");
  assert.equal(checkinAlert("10:00", false, now(700)), null);
  assert.equal(checkinAlert("10:00", false, now(722)), "escalated");
  assert.equal(checkinAlert("10:00", true, now(600)), null);
});

test("daily summary counts taken doses", () => {
  assert.deepEqual(dailyCounts([med], new Set(["20260310_m1_0800"]), now(21 * 60)), { total: 2, taken: 1 });
});
