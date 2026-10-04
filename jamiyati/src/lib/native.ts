// جسر تطبيق أندرويد (APK): عند التشغيل داخل التطبيق الأصلي يوفّر MainActivity الكائن window.JamiyatiNative.
// في المتصفح/PWA تبقى كل الدوال تعمل بالبدائل القياسية (تنزيل، window.print، Notification API، WebAuthn).

interface NativeBridge {
  saveFile(base64: string, filename: string, mime: string, share: boolean): string;
  print(title: string): void;
  notify(title: string, body: string): void;
  notificationPermission(): string; // granted | denied | default
  requestNotificationPermission(): void;
  scheduleReminders(json: string): void;
  biometricAvailable(): boolean;
  authenticate(requestId: string, title: string): void;
  copy(text: string): void;
  openExternal(url: string): void;
  appVersion(): string;
}

declare global {
  interface Window {
    JamiyatiNative?: NativeBridge;
    __jamiyatiBio?: (id: string, ok: boolean) => void;
  }
}

export const native = (): NativeBridge | undefined => (typeof window !== 'undefined' ? window.JamiyatiNative : undefined);
export const isNative = () => !!native();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/** يحفظ الملف في مجلد التنزيلات (وفي التطبيق: يفتح قائمة المشاركة إن طُلب) */
export async function saveFileNative(blob: Blob, filename: string, share: boolean): Promise<string | undefined> {
  const n = native();
  if (!n) return undefined;
  return n.saveFile(await blobToBase64(blob), filename, (blob.type || 'application/octet-stream').split(';')[0], share);
}

/** طباعة / حفظ PDF */
export function printPage(title = 'جمعيتي') {
  const n = native();
  if (n) n.print(title);
  else window.print();
}

export function copyText(text: string): Promise<void> {
  const n = native();
  if (n) {
    n.copy(text);
    return Promise.resolve();
  }
  return navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('clipboard'));
}

export function notificationPermission(): string {
  const n = native();
  if (n) return n.notificationPermission();
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
}

export async function requestNotifications(): Promise<string> {
  const n = native();
  if (n) {
    n.requestNotificationPermission();
    // ننتظر رد نافذة الإذن
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const p = n.notificationPermission();
      if (p !== 'default') return p;
    }
    return n.notificationPermission();
  }
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
}

export interface ScheduledReminder {
  id: string;
  at: number; // epoch ms
  title: string;
  body: string;
}

/** في التطبيق الأصلي: تُجدول التذكيرات في نظام أندرويد فتصل حتى والتطبيق مغلق */
export function scheduleNative(list: ScheduledReminder[]) {
  native()?.scheduleReminders(JSON.stringify(list));
}

let bioSeq = 0;
const bioWaiters = new Map<string, (ok: boolean) => void>();
if (typeof window !== 'undefined') {
  window.__jamiyatiBio = (id, ok) => {
    bioWaiters.get(id)?.(ok);
    bioWaiters.delete(id);
  };
}

export function nativeBiometricAvailable(): boolean {
  try {
    return !!native()?.biometricAvailable();
  } catch {
    return false;
  }
}

export function nativeAuthenticate(title: string): Promise<boolean> {
  const n = native();
  if (!n) return Promise.resolve(false);
  const id = `b${++bioSeq}`;
  return new Promise((res) => {
    bioWaiters.set(id, res);
    n.authenticate(id, title);
  });
}

/** معرّف رمزي يُحفظ في الإعدادات عند تفعيل البصمة في التطبيق الأصلي */
export const NATIVE_BIO_ID = 'native-biometric';
