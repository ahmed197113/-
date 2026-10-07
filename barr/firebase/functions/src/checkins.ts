import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, REGION } from "./common";

/** Mirrors the latest "I'm fine" onto the elder doc + family timeline. */
export const onCheckinWritten = onDocumentWritten(
  { region: REGION, document: "families/{fid}/elders/{eid}/checkins/{day}" },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists || event.data?.before?.exists) return;
    const { fid, eid } = event.params;
    const at = after.get("at") ?? FieldValue.serverTimestamp();
    await db.doc(`families/${fid}/elders/${eid}`).update({
      lastCheckinAt: at,
      lastActivityAt: at,
      status: { level: "green", reason: "checkin", updatedAt: FieldValue.serverTimestamp() },
    });
    await db.collection(`families/${fid}/timeline`).add({
      type: "checkin",
      elderId: eid,
      actorUid: after.get("by") ?? null,
      at,
    });
  },
);
