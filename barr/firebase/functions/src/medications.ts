import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, REGION } from "./common";

/** Keeps families/{fid}.counts.medications in sync (free-plan limit). */
export const onMedicationWritten = onDocumentWritten(
  { region: REGION, document: "families/{fid}/elders/{eid}/medications/{mid}" },
  async (event) => {
    const delta = (event.data?.after?.exists ? 1 : 0) - (event.data?.before?.exists ? 1 : 0);
    if (delta !== 0) {
      await db.doc(`families/${event.params.fid}`).update({
        "counts.medications": FieldValue.increment(delta),
      });
    }
  },
);

/**
 * When a dose becomes "taken": decrement tracked stock once, mark activity,
 * and add a timeline entry. (Missed-dose alerts come in phase 3.)
 */
export const onDoseLogWritten = onDocumentWritten(
  { region: REGION, document: "families/{fid}/elders/{eid}/doseLogs/{doseId}" },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!after?.exists) return;
    const becameTaken = after.get("status") === "taken" && before?.get("status") !== "taken";
    const { fid, eid } = event.params;
    const elderRef = db.doc(`families/${fid}/elders/${eid}`);

    if (becameTaken) {
      const medRef = elderRef.collection("medications").doc(after.get("medId"));
      await db.runTransaction(async (tx) => {
        const med = await tx.get(medRef);
        const qty = med.get("stock.qty");
        if (!med.exists || typeof qty !== "number") return;
        const perDose = med.get("stock.perDose") ?? 1;
        tx.update(medRef, { "stock.qty": Math.max(0, qty - perDose) });
      });
    }
    await elderRef.update({ lastActivityAt: FieldValue.serverTimestamp() });
    await db.collection(`families/${fid}/timeline`).add({
      type: `dose_${after.get("status")}`,
      elderId: eid,
      medId: after.get("medId"),
      doseId: event.params.doseId,
      actorUid: after.get("by") ?? null,
      at: FieldValue.serverTimestamp(),
    });
  },
);
