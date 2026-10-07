import { randomInt } from "crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  auth, db, FieldValue, LINK_CODE_TTL_MS, REGION, requireAuth, requireRole, requireString,
} from "./common";

/** Caregiver issues a one-time 6-digit code for an elder. */
export const createLinkCode = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req);
  const familyId = requireString(req.data?.familyId, "familyId");
  const elderId = requireString(req.data?.elderId, "elderId");
  await requireRole(familyId, uid, ["admin", "caregiver"]);
  const elder = await db.doc(`families/${familyId}/elders/${elderId}`).get();
  if (!elder.exists) throw new HttpsError("not-found", "Elder not found");

  const expiresAt = Date.now() + LINK_CODE_TTL_MS;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const ref = db.doc(`linkCodes/${code}`);
    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists && existing.get("expiresAt") > Date.now() && !existing.get("usedAt")) {
          throw new Error("collision");
        }
        tx.set(ref, { familyId, elderId, createdBy: uid, expiresAt, usedAt: null, attempts: 0 });
      });
      return { code, expiresAt };
    } catch (e) {
      if ((e as Error).message !== "collision") throw e;
    }
  }
  throw new HttpsError("resource-exhausted", "Try again");
});

/**
 * Parent device redeems a code. Works signed-out (returns a custom token
 * for a dedicated elder account) or signed in as an elder (links that
 * account). Codes are single-use and expire after 15 minutes.
 */
export const redeemLinkCode = onCall({ region: REGION, enforceAppCheck: false }, async (req) => {
  const code = typeof req.data?.code === "string" ? req.data.code : "";
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Invalid code", "link-code");

  const callerUid = req.auth?.uid;
  let callerIsElder = false;
  if (callerUid) {
    const caller = await db.doc(`users/${callerUid}`).get();
    callerIsElder = caller.exists && caller.get("accountType") === "elder";
  }

  const result = await db.runTransaction(async (tx) => {
    const codeRef = db.doc(`linkCodes/${code}`);
    const snap = await tx.get(codeRef);
    if (!snap.exists || snap.get("usedAt") || snap.get("expiresAt") <= Date.now()) {
      throw new HttpsError("not-found", "Invalid or expired code", "link-code");
    }
    const familyId = snap.get("familyId") as string;
    const elderId = snap.get("elderId") as string;
    const elderRef = db.doc(`families/${familyId}/elders/${elderId}`);
    const elder = await tx.get(elderRef);
    if (!elder.exists) throw new HttpsError("not-found", "Invalid code", "link-code");

    const uid = callerIsElder ? callerUid! : `elder_${familyId}_${elderId}`;
    const displayName = elder.get("nickname") || elder.get("name");
    const userRef = db.doc(`users/${uid}`);
    const user = await tx.get(userRef);

    tx.set(userRef, {
      displayName: user.exists ? user.get("displayName") : displayName,
      accountType: "elder",
      phone: user.exists ? user.get("phone") ?? null : elder.get("phone") ?? null,
      familyIds: [familyId],
      elderRef: { familyId, elderId },
      ...(user.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    tx.set(db.doc(`families/${familyId}/members/${uid}`), {
      role: "elder",
      elderId,
      displayName,
      phone: elder.get("phone") ?? null,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.update(elderRef, { linkedUid: uid, linkedAt: FieldValue.serverTimestamp() });
    tx.update(codeRef, { usedAt: Date.now(), usedBy: uid });
    return { uid, familyId, elderId };
  });

  if (callerIsElder) return { familyId: result.familyId, elderId: result.elderId };
  await auth.getUser(result.uid).catch(() => auth.createUser({ uid: result.uid }));
  const customToken = await auth.createCustomToken(result.uid, { elder: true });
  return { customToken, familyId: result.familyId, elderId: result.elderId };
});
