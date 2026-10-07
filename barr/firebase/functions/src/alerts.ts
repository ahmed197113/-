import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { db, FieldValue, REGION } from "./common";
import {
  checkinAlert, dailyCounts, localNow, MedicationDoc, newlyMissedDoses, RUN_EVERY_MIN, crossedNow, hmToMinutes,
} from "./alertLogic";
import { notifyFamily, PushKind } from "./messaging";

const SUMMARY_AT = "21:00";

/** Creates the alert once (idempotent by id) and pushes it. */
async function raise(
  familyId: string,
  alertId: string,
  kind: PushKind,
  severity: "info" | "warning" | "critical",
  elderId: string,
  title: string,
  body: string,
  extra: Record<string, string> = {},
): Promise<void> {
  try {
    await db.doc(`families/${familyId}/alerts/${alertId}`).create({
      type: kind,
      severity,
      elderId,
      title,
      body,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
      ...extra,
    });
  } catch {
    return; // Already raised.
  }
  await notifyFamily(familyId, kind, title, body, { elderId, alertId, ...extra });
}

/** SOS: loud push to the whole family immediately. */
export const onSosCreated = onDocumentCreated(
  { region: REGION, document: "families/{fid}/elders/{eid}/sosEvents/{sid}" },
  async (event) => {
    const { fid, eid, sid } = event.params;
    const elder = await db.doc(`families/${fid}/elders/${eid}`).get();
    const name = elder.get("nickname") || elder.get("name") || "";
    await raise(fid, `sos_${sid}`, "sos", "critical", eid,
      `🚨 ${name} ضغط زر الطوارئ`, "اضغط لعرض الموقع والاتصال به", { eventId: sid });
    await db.collection(`families/${fid}/timeline`).add({
      type: "sos", elderId: eid, eventId: sid, at: FieldValue.serverTimestamp(),
    });
  },
);

/**
 * Every 5 minutes, per linked parent (in their timezone):
 * missed doses (30 min), check-in deadline + escalation, inactivity, and
 * the evening summary.
 */
export const checkAlerts = onSchedule(
  { region: REGION, schedule: `every ${RUN_EVERY_MIN} minutes`, timeoutSeconds: 300 },
  async () => {
    const families = await db.collection("families").select().get();
    for (const fam of families.docs) {
      const elders = await fam.ref.collection("elders").where("linkedUid", "!=", null).get();
      for (const elder of elders.docs) {
        try {
          await checkElder(fam.id, elder);
        } catch (e) {
          logger.error("checkElder failed", { familyId: fam.id, elderId: elder.id, e });
        }
      }
    }
  },
);

async function checkElder(familyId: string, elder: FirebaseFirestore.QueryDocumentSnapshot) {
  const tz: string = elder.get("timezone") || "Asia/Riyadh";
  const now = localNow(new Date(), tz);
  const name: string = elder.get("nickname") || elder.get("name") || "";
  const eid = elder.id;

  const meds: MedicationDoc[] = (await elder.ref.collection("medications").where("active", "==", true).get())
    .docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MedicationDoc, "id">) }));
  const logs = await elder.ref.collection("doseLogs")
    .where("__name__", ">=", `${now.day}_`).where("__name__", "<", `${now.day}~`).get();
  const taken = new Set(logs.docs.filter((d) => d.get("status") === "taken").map((d) => d.id));
  const done = new Set(logs.docs.filter((d) => ["taken", "skipped"].includes(d.get("status"))).map((d) => d.id));

  for (const dose of newlyMissedDoses(meds, done, now)) {
    await raise(familyId, `missed_${eid}_${dose.doseId}`, "missedDose", "warning", eid,
      `💊 ${name} لم يؤكد دواء ${dose.medName}`,
      "مرّت 30 دقيقة على موعد الجرعة دون تأكيد", { doseId: dose.doseId });
  }

  const lastCheckin: Date | undefined = elder.get("lastCheckinAt")?.toDate?.();
  const checkedIn = lastCheckin !== undefined && localNow(lastCheckin, tz).day === now.day;
  const checkin = checkinAlert(elder.get("checkinDeadline") || "10:00", checkedIn, now);
  if (checkin) {
    await raise(familyId, `checkin_${checkin}_${eid}_${now.day}`, "noCheckin",
      checkin === "escalated" ? "critical" : "warning", eid,
      checkin === "escalated" ? `⚠️ لا اطمئنان من ${name} منذ الصباح` : `${name} لم يضغط «أنا بخير» بعد`,
      checkin === "escalated" ? "اتصل به للاطمئنان عليه" : "قد يكون نسي — تواصل معه");
  }

  const hours: number | undefined = elder.get("inactivityHours");
  if (hours) {
    const seen = [elder.get("lastSeenAt"), elder.get("lastCheckinAt"), elder.get("lastActivityAt")]
      .map((t) => t?.toDate?.()?.getTime() ?? 0);
    const last = Math.max(...seen);
    if (last > 0 && Date.now() - last >= hours * 3600_000) {
      await raise(familyId, `inactive_${eid}_${last}`, "inactivity", "critical", eid,
        `📵 لا نشاط على جوال ${name}`, `لم يُفتح التطبيق منذ أكثر من ${hours} ساعة`);
    }
  }

  const summaryAt = hmToMinutes(SUMMARY_AT)!;
  if (crossedNow(summaryAt, now.minutes)) {
    const c = dailyCounts(meds, taken, now);
    if (c.total > 0) {
      await raise(familyId, `summary_${eid}_${now.day}`, "summary", "info", eid,
        `ملخص اليوم: ${name}`, `تناول ${name} ${c.taken} من ${c.total} أدوية اليوم`);
    }
  }
}
