import { getMessaging } from "firebase-admin/messaging";
import { db } from "./common";

export type PushKind = "sos" | "missedDose" | "noCheckin" | "inactivity" | "summary";

const PREF_KEY: Record<PushKind, string> = {
  sos: "sos",
  missedDose: "missedDose",
  noCheckin: "checkin",
  inactivity: "inactivity",
  summary: "dailySummary",
};

/**
 * Sends a push to every caregiver/admin of the family (viewers get SOS
 * only), honouring each member's notificationPrefs. Removes dead tokens.
 */
export async function notifyFamily(
  familyId: string,
  kind: PushKind,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  const members = await db.collection(`families/${familyId}/members`).get();
  const recipients = members.docs.filter((m) => {
    const role = m.get("role");
    if (role === "elder") return false;
    if (role === "viewer" && kind !== "sos") return false;
    return m.get(`notificationPrefs.${PREF_KEY[kind]}`) !== false;
  });

  const tokens: { token: string; ref: FirebaseFirestore.DocumentReference }[] = [];
  for (const m of recipients) {
    const devices = await db.collection(`users/${m.id}/devices`).get();
    devices.forEach((d) => tokens.push({ token: d.get("token"), ref: d.ref }));
  }
  if (tokens.length === 0) return;

  const isSos = kind === "sos";
  const res = await getMessaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: { ...data, type: kind, familyId },
    android: {
      priority: "high",
      notification: {
        channelId: isSos ? "barr_sos_v1" : "barr_alerts_v1",
        priority: isSos ? "max" : "high",
        defaultSound: !isSos,
      },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: {
        aps: {
          sound: isSos ? { critical: true, name: "default", volume: 1 } : "default",
          "interruption-level": isSos ? "critical" : "time-sensitive",
        },
      },
    },
  });
  await Promise.all(
    res.responses.map((r, i) => {
      const code = r.error?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        return tokens[i].ref.delete();
      }
      return undefined;
    }),
  );
}
