import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";

initializeApp();

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue };

export const REGION = "me-central2"; // Dammam — closest to KSA users.

export const FREE_LIMITS = { maxElders: 1, maxMembers: 2, maxMedications: 3 };
export const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export type Role = "admin" | "caregiver" | "viewer" | "elder";

export function requireAuth(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  return req.auth.uid;
}

export async function requireRole(fid: string, uid: string, roles: Role[]): Promise<void> {
  const m = await db.doc(`families/${fid}/members/${uid}`).get();
  if (!m.exists || !roles.includes(m.get("role"))) {
    throw new HttpsError("permission-denied", "Not allowed for this family");
  }
}

export function requireString(v: unknown, name: string, max = 80): string {
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) {
    throw new HttpsError("invalid-argument", `Invalid ${name}`);
  }
  return v.trim();
}
