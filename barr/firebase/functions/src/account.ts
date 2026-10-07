import { onCall } from "firebase-functions/v2/https";
import { auth, db, FieldValue, REGION, requireAuth } from "./common";

/**
 * Deletes the caller's account and data (Google Play account-deletion policy).
 * Families the caller owns are deleted entirely; elsewhere only the
 * membership is removed.
 */
export const deleteAccount = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const userRef = db.doc(`users/${uid}`);
  const user = await userRef.get();
  const familyIds: string[] = user.get("familyIds") ?? [];

  for (const fid of familyIds) {
    const familyRef = db.doc(`families/${fid}`);
    const family = await familyRef.get();
    if (family.get("ownerUid") === uid) {
      const members = await familyRef.collection("members").get();
      await db.recursiveDelete(familyRef);
      await Promise.all(members.docs
        .filter((m) => m.id !== uid)
        .map((m) => db.doc(`users/${m.id}`).update({
          familyIds: FieldValue.arrayRemove(fid),
          ...(m.get("role") === "elder" ? { elderRef: FieldValue.delete() } : {}),
        }).catch(() => undefined)));
    } else {
      await familyRef.collection("members").doc(uid).delete();
    }
  }
  await db.recursiveDelete(userRef);
  await auth.deleteUser(uid);
  return { ok: true };
});
