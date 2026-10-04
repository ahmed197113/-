import { useState } from 'react';
import { auth, COUNTRIES, normalizePhone, REQUIRE_OTP } from '../../lib/auth';
import { getLang, L } from '../../lib/i18n';
import * as A from '../../store/actions';
import { getDB, setDB } from '../../store/db';
import { buildDemoDB } from '../../store/seed';
import { Icon } from '../components/Icon';
import { Field, toast, toastError } from '../components/ui';
import { go } from '../router';

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#0f766e" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="3.5" strokeDasharray="8 5" />
      <circle cx="32" cy="15" r="5" fill="#f6c453" />
      <path d="M25 33l5 5 9-10" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Welcome() {
  const startDemo = () => {
    const d = buildDemoDB();
    d.settings = { ...getDB().settings, onboarded: true };
    setDB(d);
    go('/', true);
    toast(L('مرحباً أحمد! هذه بيانات تجريبية للتجربة 👋', 'Welcome! This is demo data 👋'));
  };
  return (
    <main style={{ minHeight: '100dvh', justifyContent: 'center', gap: 18 }}>
      <div className="row between">
        <span />
        <button className="btn sm ghost" onClick={() => A.updateSettings({ lang: getLang() === 'ar' ? 'en' : 'ar' })}>
          {getLang() === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <Logo size={84} />
        <h1 style={{ margin: '8px 0 0', fontSize: '2rem' }}>{L('جمعيتي', 'Jamiyati')}</h1>
        <p className="muted" style={{ margin: 0, fontSize: '1.05rem' }}>
          {L('نظّم جمعيتك بثقة: مين دفع، ومتى دورك، وكل دفعة بإيصال.', 'Run your savings circle with confidence: who paid, whose turn, a receipt for every payment.')}
        </p>
      </div>
      <div className="card stack" style={{ gap: 12 }}>
        {[
          ['bell', L('تذكير لطيف تلقائي ورسائل واتساب جاهزة — بلا إحراج', 'Gentle automatic reminders and ready WhatsApp messages')],
          ['dice', L('قرعة شفافة يشاهدها الجميع وتُحفظ نتيجتها', 'Transparent lottery everyone can verify')],
          ['receipt', L('إثبات وإيصال لكل دفعة وسجل لا يُمحى', 'Proof, receipt, and a tamper-evident log for every payment')],
          ['shield', L('لا نحتفظ بأموالك — الدفع بينكم مباشرة، بلا فوائد', 'We never hold money — you pay each other directly, no interest')],
        ].map(([ic, t]) => (
          <div className="row" key={ic}>
            <span className="avatar sm">
              <Icon name={ic} size={18} />
            </span>
            <span>{t}</span>
          </div>
        ))}
      </div>
      <button className="btn block" onClick={() => go('/login')}>
        {L('ابدأ برقم جوالك', 'Start with your phone')}
      </button>
      <button className="btn soft block" onClick={startDemo}>
        {L('جرّب ببيانات تجريبية', 'Try with demo data')}
      </button>
      <button className="btn ghost block" onClick={() => go('/tools')}>
        <Icon name="book" /> {L('ما هي الجمعية؟ وهل تناسبني؟', 'What is a savings circle?')}
      </button>
    </main>
  );
}

export function Login() {
  const [country, setCountry] = useState('966');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [code, setCode] = useState('');
  const [demo, setDemo] = useState<string>();
  const [err, setErr] = useState('');
  const full = normalizePhone(phone, country);
  const existing = getDB().users.find((u) => u.phone === full);
  const valid = phone.replace(/\D/g, '').length >= 8;

  const finish = () => {
    if (!existing && !name.trim()) {
      setErr(L('اكتب اسمك ليعرفك أعضاء الجمعية', 'Enter your name'));
      return;
    }
    A.signIn(full, name.trim());
    const c = COUNTRIES.find((x) => x.code === country);
    if (c) sessionStorage.setItem('jamiyati:currency', c.cur);
    go('/', true);
  };
  const send = async () => {
    setErr('');
    if (!REQUIRE_OTP) return finish();
    try {
      const r = await auth.sendOtp(full);
      setDemo(r.demoCode);
      setStep('otp');
    } catch (e) {
      toastError(e);
    }
  };
  const verify = async () => {
    if (!(await auth.verifyOtp(full, code))) {
      setErr(L('الرمز غير صحيح. تأكد من الأرقام أو اطلب رمزاً جديداً.', 'Incorrect code. Check it or request a new one.'));
      return;
    }
    finish();
  };

  return (
    <>
      <header className="top">
        <button className="icon-btn" onClick={() => (step === 'otp' ? setStep('phone') : go('/'))} aria-label={L('رجوع', 'Back')}>
          <Icon name="back" className="flip" />
        </button>
        <h1>{L('حسابك', 'Your account')}</h1>
      </header>
      <main>
        {step === 'phone' ? (
          <div className="card stack">
            <h2>{L('رقم جوالك', 'Your phone number')}</h2>
            <Field label={L('الدولة', 'Country')}>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {L(c.ar, c.en)} (+{c.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={L('رقم الجوال', 'Phone number')}>
              <input className="input ltr num" inputMode="tel" autoComplete="tel-national" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
            </Field>
            {!REQUIRE_OTP && !existing && (
              <Field label={L('اسمك', 'Your name')}>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            {err && <div className="error">{err}</div>}
            <button className="btn block" disabled={!valid || (!REQUIRE_OTP && !existing && !name.trim())} onClick={send}>
              {REQUIRE_OTP ? L('أرسل رمز التحقق', 'Send code') : L('ابدأ', 'Start')}
            </button>
            <div className="small muted">
              {REQUIRE_OTP
                ? L('سنرسل رمزاً من 6 أرقام. لا نشارك رقمك مع أعضاء الجمعيات إلا بإذنك.', "We'll send a 6-digit code. Your number is never shown to others without permission.")
                : L('بياناتك محفوظة على جهازك فقط. رقمك يُستخدم لربطك بالجمعيات ورسائل واتساب، ولا يظهر لأحد إلا بإذنك.', 'Your data stays on this device. Your number is never shown without permission.')}
            </div>
          </div>
        ) : (
          <div className="card stack">
            <h2>{L('أدخل الرمز', 'Enter the code')}</h2>
            <div className="muted small">
              {L('أُرسل إلى', 'Sent to')} <bdi className="num">+{full}</bdi>
            </div>
            {demo && (
              <div className="note">
                {L('نسخة تجريبية: رمزك هو', 'Demo build: your code is')} <b className="num" style={{ letterSpacing: 3 }}>{demo}</b>
              </div>
            )}
            <input
              className="input ltr num code"
              style={{ textAlign: 'center', fontSize: '1.6rem' }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-label={L('رمز التحقق', 'Verification code')}
              autoFocus
            />
            {!existing && (
              <Field label={L('اسمك', 'Your name')}>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            {err && <div className="error">{err}</div>}
            <button className="btn block" disabled={code.length !== 6} onClick={verify}>
              {L('دخول', 'Sign in')}
            </button>
            <button className="btn ghost block" onClick={send}>
              {L('إعادة إرسال الرمز', 'Resend code')}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
