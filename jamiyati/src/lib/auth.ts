// المصادقة برقم الجوال + OTP.
// النسخة الحالية: تجريبية محلية (الرمز يظهر على الشاشة). للإنتاج فعّل SupabaseAuth أدناه:
//
//   import { createClient } from '@supabase/supabase-js';
//   const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
//   sendOtp:   await sb.auth.signInWithOtp({ phone: '+' + phone })          // عبر Twilio/MessageBird/WhatsApp
//   verifyOtp: await sb.auth.verifyOtp({ phone: '+' + phone, token: code, type: 'sms' })

export interface AuthProvider {
  sendOtp(phone: string): Promise<{ demoCode?: string }>;
  verifyOtp(phone: string, code: string): Promise<boolean>;
}

const pending = new Map<string, string>();

export const LocalDemoAuth: AuthProvider = {
  async sendOtp(phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pending.set(phone, code);
    return { demoCode: code };
  },
  async verifyOtp(phone, code) {
    return pending.get(phone) === code.trim();
  },
};

export const auth: AuthProvider = LocalDemoAuth;

/** يطبّع الرقم إلى صيغة دولية بلا +: 05xxxxxxxx ← 9665xxxxxxxx، 01xxxxxxxxx ← 201xxxxxxxxx */
export function normalizePhone(raw: string, country: string): string {
  let p = raw.replace(/[^\d+]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  p = p.replace(/^\+/, '').replace(/^00/, '');
  if (p.startsWith(country)) return p;
  return country + p.replace(/^0+/, '');
}

export const COUNTRIES = [
  { code: '966', ar: 'السعودية', en: 'Saudi Arabia', cur: 'SAR' },
  { code: '20', ar: 'مصر', en: 'Egypt', cur: 'EGP' },
  { code: '971', ar: 'الإمارات', en: 'UAE', cur: 'AED' },
  { code: '965', ar: 'الكويت', en: 'Kuwait', cur: 'KWD' },
  { code: '974', ar: 'قطر', en: 'Qatar', cur: 'QAR' },
  { code: '973', ar: 'البحرين', en: 'Bahrain', cur: 'BHD' },
  { code: '968', ar: 'عُمان', en: 'Oman', cur: 'OMR' },
  { code: '962', ar: 'الأردن', en: 'Jordan', cur: 'JOD' },
  { code: '963', ar: 'سوريا', en: 'Syria', cur: 'SYP' },
  { code: '961', ar: 'لبنان', en: 'Lebanon', cur: 'LBP' },
];

/** قفل التطبيق: PIN بتجزئة SHA-256 + بصمة عبر WebAuthn (مصادقة المنصة) */
export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('jamiyati:' + s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function registerBiometric(userName: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Jamiyati' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userName, displayName: userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  })) as PublicKeyCredential;
  return b64(cred.rawId);
}

export async function verifyBiometric(id: string): Promise<boolean> {
  try {
    const r = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60000 },
    });
    return !!r;
  } catch {
    return false;
  }
}
