import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue, FREE_LIMITS, REGION, requireAuth, requireString } from "./common";

/** Creates a family and makes the caller its admin, atomically. */
export const createFamily = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const name = requireString(req.data?.name, "name", 60);
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists || user.get("accountType") !== "caregiver") {
    throw new HttpsError("permission-denied", "Only caregivers can create a family");
  }
  const ref = db.collection("families").doc();
  const batch = db.batch();
  batch.set(ref, {
    name,
    ownerUid: uid,
    createdAt: FieldValue.serverTimestamp(),
    plan: "free",
    limits: FREE_LIMITS,
    // Counters are maintained by the on*Written triggers below.
    counts: { elders: 0, members: 0, invites: 0, medications: 0 },
  });
  batch.set(ref.collection("members").doc(uid), {
    role: "admin",
    displayName: user.get("displayName"),
    phone: user.get("phone") ?? null,
    joinedAt: FieldValue.serverTimestamp(),
  });
  batch.update(user.ref, { familyIds: FieldValue.arrayUnion(ref.id) });
  await batch.commit();
  return { familyId: ref.id };
});

/** Joins every family that invited the caller's verified phone number. */
export const claimInvites = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const phone = req.auth?.token.phone_number;
  if (!phone) return { joined: [] };
  const user = await db.doc(`users/${uid}`).get();
  if (user.get("accountType") !== "caregiver") return { joined: [] };

  const invites = await db
    .collectionGroup("invites")
    .where("phone", "==", phone)
    .where("status", "==", "pending")
    .get();
  const joined: string[] = [];
  for (const inv of invites.docs) {
    const familyRef = inv.ref.parent.parent!;
    if (inv.get("expiresAt")?.toMillis?.() < Date.now()) continue;
    const batch = db.batch();
    batch.set(familyRef.collection("members").doc(uid), {
      role: inv.get("role"),
      displayName: user.get("displayName"),
      phone,
      joinedAt: FieldValue.serverTimestamp(),
    });
    batch.update(inv.ref, { status: "accepted", acceptedBy: uid });
    batch.update(user.ref, { familyIds: FieldValue.arrayUnion(familyRef.id) });
    await batch.commit();
    joined.push(familyRef.id);
  }
  return { joined };
});

/** Keeps families/{fid}.counts in sync (used by security rules for plan limits). */
export const onMemberWritten = onDocumentWritten(
  { region: REGION, document: "families/{fid}/members/{uid}" },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const wasCounted = before?.exists && before.get("role") !== "elder";
    const isCounted = after?.exists && after.get("role") !== "elder";
    const delta = (isCounted ? 1 : 0) - (wasCounted ? 1 : 0);
    if (delta !== 0) {
      await db.doc(`families/${event.params.fid}`).update({
        "counts.members": FieldValue.increment(delta),
      });
    }
    if (before?.exists && !after?.exists) {
      await db.doc(`users/${event.params.uid}`).update({
        familyIds: FieldValue.arrayRemove(event.params.fid),
      }).catch(() => undefined);
    }
  },
);

export const onInviteWritten = onDocumentWritten(
  { region: REGION, document: "families/{fid}/invites/{id}" },
  async (event) => {
    const pending = (s?: FirebaseFirestore.DocumentSnapshot) => s?.exists && s.get("status") === "pending";
    const delta = (pending(event.data?.after) ? 1 : 0) - (pending(event.data?.before) ? 1 : 0);
    if (delta !== 0) {
      await db.doc(`families/${event.params.fid}`).update({ "counts.invites": FieldValue.increment(delta) });
    }
  },
);

export const onElderWritten = onDocumentWritten(
  { region: REGION, document: "families/{fid}/elders/{eid}" },
  async (event) => {
    const delta = (event.data?.after?.exists ? 1 : 0) - (event.data?.before?.exists ? 1 : 0);
    if (delta !== 0) {
      await db.doc(`families/${event.params.fid}`).update({ "counts.elders": FieldValue.increment(delta) });
    }
  },
);
