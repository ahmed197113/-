import { useEffect, useState } from 'react';
import { todayISO } from '../../domain/dates';
import type { PaymentMethod, Settings } from '../../domain/types';
import { biometricAvailable, registerBiometric, sha256 } from '../../lib/auth';
import { recurringCSV, transactionsCSV } from '../../lib/csv';
import { downloadBlob } from '../../lib/image';
import { L } from '../../lib/i18n';
import { methodLabel, num } from '../../lib/format';
import * as A from '../../store/actions';
import { emptyDB, exportBackup, getDB, importBackup, setDB, useDB } from '../../store/db';
import { buildDemoDB } from '../../store/seed';
import { FREE_LIMITS, organizedActiveCount, userReliability } from '../../store/selectors';
import { Icon } from '../components/Icon';
import { ReputationLine } from '../components/sheets';
import { attempt, Field, Seg, Sheet, toast, toastError, TopBar } from '../components/ui';
import { go } from '../router';

export function SettingsScreen() {
  const db = useDB();
  const s = db.settings;
  const me = db.users.find((u) => u.id === db.currentUserId)!;
  const today = todayISO();
  const rel = userReliability(db, me.id, today);
  const [name, setName] = useState(me.name);
  const [pinSheet, setPinSheet] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const set = (p: Partial<Settings>) => A.updateSettings(p);
  useEffect(() => {
    biometricAvailable().then(setBioOk);
    if (location.hash.includes('export')) document.getElementById('export')?.scrollIntoView();
  }, []);
  const csv = (text: string, file: string) => downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), file);

  return (
    <>
      <TopBar title={L('حسابي والإعدادات', 'Account & settings')} />
      <main>
        <section className="card stack">
          <h2>{L('ملفي', 'Profile')}</h2>
          <Field label={L('الاسم', 'Name')}>
            <div className="row">
              <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
              {name !== me.name && (
                <button className="btn sm" onClick={() => attempt(() => A.updateProfile({ name: name.trim() }), L('حُفظ', 'Saved'))}>
                  {L('حفظ', 'Save')}
                </button>
              )}
            </div>
          </Field>
          <div className="small muted">
            {L('الجوال', 'Phone')}: <bdi dir="ltr">+{me.phone}</bdi>
          </div>
          <Field label={L('وسيلة الدفع المفضلة', 'Preferred payment')}>
            <Seg value={me.preferredPayment ?? 'bank'} onChange={(v: PaymentMethod) => A.updateProfile({ preferredPayment: v })} options={(['bank', 'wallet', 'cash'] as PaymentMethod[]).map((m) => ({ v: m, t: methodLabel(m) }))} />
          </Field>
        </section>

        <section className="card stack">
          <h2>⭐ {L('سجل التزامي', 'My reliability')}</h2>
          <ReputationLine stats={rel} />
          <div className="tiny muted">{L('محسوب من دفعاتك في كل جمعياتك: نسبة الدفع في الموعد، ومتوسط أيام التأخير، والجمعيات المكتملة.', 'Computed from all your circles.')}</div>
        </section>

        <section className="card stack">
          <h2>
            <Icon name="shield" size={20} /> {L('الخصوصية', 'Privacy')}
          </h2>
          <label className="check">
            <input type="checkbox" checked={me.shareReputation} onChange={(e) => A.updateProfile({ shareReputation: e.target.checked })} />
            <span>
              {L('مشاركة سجل التزامي مع المنظِّمين', 'Share my reliability with organizers')}
              <div className="tiny muted">{L('يظهر للمنظِّم عند دعوتك لجمعية جديدة', 'Shown when an organizer invites you')}</div>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={me.showPhone} onChange={(e) => A.updateProfile({ showPhone: e.target.checked })} />
            <span>
              {L('إظهار رقم جوالي لأعضاء جمعياتي', 'Show my phone to fellow members')}
              <div className="tiny muted">{L('المنظِّم يراه دائماً للتواصل والتذكير', 'Organizers always see it')}</div>
            </span>
          </label>
        </section>

        <section className="card stack">
          <h2>{L('العرض', 'Display')}</h2>
          <Field label={L('اللغة', 'Language')}>
            <Seg value={s.lang} onChange={(v) => set({ lang: v })} options={[{ v: 'ar', t: 'العربية' }, { v: 'en', t: 'English' }]} />
          </Field>
          <Field label={L('المظهر', 'Theme')}>
            <Seg value={s.theme} onChange={(v) => set({ theme: v })} options={[{ v: 'system', t: L('تلقائي', 'Auto') }, { v: 'light', t: L('فاتح', 'Light') }, { v: 'dark', t: L('داكن', 'Dark') }]} />
          </Field>
          <Field label={L('التقويم', 'Calendar')}>
            <Seg value={s.calendar} onChange={(v) => set({ calendar: v })} options={[{ v: 'gregory', t: L('ميلادي', 'Gregorian') }, { v: 'islamic', t: L('هجري', 'Hijri') }, { v: 'both', t: L('كلاهما', 'Both') }]} />
          </Field>
          <Field label={L('الأرقام', 'Digits')}>
            <Seg value={s.digits} onChange={(v) => set({ digits: v })} options={[{ v: 'latn', t: '123' }, { v: 'arab', t: '١٢٣' }]} />
          </Field>
          <Field label={L('حجم الخط', 'Text size')}>
            <Seg value={s.fontScale} onChange={(v) => set({ fontScale: v })} options={[{ v: 1, t: L('عادي', 'Normal') }, { v: 1.12, t: L('كبير', 'Large') }, { v: 1.25, t: L('أكبر', 'Larger') }]} />
          </Field>
        </section>

        <section className="card stack">
          <h2>
            <Icon name="lock" size={20} /> {L('الأمان', 'Security')}
          </h2>
          <button className="btn soft block" onClick={() => (s.pinHash ? set({ pinHash: undefined }) : setPinSheet(true))}>
            {s.pinHash ? L('إيقاف قفل الرمز', 'Disable PIN lock') : L('قفل التطبيق برمز', 'Lock with a PIN')}
          </button>
          {bioOk && (
            <button
              className="btn soft block"
              onClick={async () => {
                if (s.biometricId) return set({ biometricId: undefined });
                try {
                  set({ biometricId: await registerBiometric(me.name) });
                  toast(L('فُعّل القفل بالبصمة ✓', 'Biometric lock enabled ✓'));
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <Icon name="fingerprint" /> {s.biometricId ? L('إيقاف البصمة', 'Disable biometrics') : L('القفل بالبصمة / الوجه', 'Biometric lock')}
            </button>
          )}
        </section>

        <section className="card stack" id="export">
          <h2>
            <Icon name="download" size={20} /> {L('التصدير والنسخ الاحتياطي', 'Export & backup')}
          </h2>
          <button className="btn soft block" onClick={() => csv(transactionsCSV(getDB(), me.id, today), 'jamiyati-transactions.csv')}>
            {L('الحركات (CSV) لتطبيق الميزانية', 'Transactions CSV')}
          </button>
          <button className="btn soft block" onClick={() => csv(recurringCSV(getDB(), me.id, today), 'jamiyati-recurring.csv')}>
            {L('الالتزامات: قسط = مصروف ثابت، استلام = دخل متوقع', 'Recurring: installment = fixed expense, payout = expected income')}
          </button>
          <button className="btn ghost block" onClick={() => downloadBlob(new Blob([exportBackup()], { type: 'application/json' }), `jamiyati-backup-${today}.json`)}>
            {L('نسخة احتياطية كاملة (JSON)', 'Full backup (JSON)')}
          </button>
          <label className="btn ghost block" style={{ cursor: 'pointer' }}>
            {L('استعادة نسخة احتياطية', 'Restore backup')}
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!confirm(L('ستُستبدل بياناتك الحالية بالنسخة الاحتياطية. متابعة؟', 'Replace current data with the backup?'))) return;
                try {
                  importBackup(await f.text());
                  toast(L('تمت الاستعادة ✓', 'Restored ✓'));
                } catch (er) {
                  toastError(er);
                }
              }}
            />
          </label>
        </section>

        <section className="card stack">
          <h2>{L('الخطة', 'Plan')}</h2>
          <div className="row between">
            <b>{s.premium ? L('المميزة ✨', 'Premium ✨') : L('المجانية', 'Free')}</b>
            {!s.premium && (
              <span className="small muted">
                {num(organizedActiveCount(db, me.id))}/{num(FREE_LIMITS.circles)} {L('جمعيات نشطة', 'active circles')}
              </span>
            )}
          </div>
          <div className="small">
            {s.premium
              ? L('جمعيات وأعضاء بلا حد، تقارير PDF، إيصالات بلا علامة، وتذكيرات واتساب تلقائية.', 'Unlimited circles and members, PDF reports, unbranded receipts, automatic WhatsApp reminders.')
              : L(`حتى ${FREE_LIMITS.circles} جمعيات نشطة و${FREE_LIMITS.members} أعضاء لكل جمعية.`, `Up to ${FREE_LIMITS.circles} active circles, ${FREE_LIMITS.members} members each.`)}
          </div>
          <button className="btn ghost block" onClick={() => set({ premium: !s.premium })}>
            {s.premium ? L('العودة للمجانية (تجريبي)', 'Back to Free (demo)') : L('تجربة المميزة (تجريبي — بلا دفع)', 'Try Premium (demo — no payment)')}
          </button>
        </section>

        <section className="card stack">
          <button className="btn ghost block" onClick={() => go('/tools')}>
            <Icon name="calc" /> {L('حاسبة الملاءمة ودليل الجمعية', 'Calculator & guide')}
          </button>
          <button
            className="btn ghost block"
            onClick={() => {
              if (!confirm(L('إعادة تحميل البيانات التجريبية؟ ستُحذف بياناتك المحلية.', 'Reload demo data? Local data will be replaced.'))) return;
              const d = buildDemoDB();
              d.settings = { ...getDB().settings };
              setDB(d);
              go('/', true);
            }}
          >
            {L('إعادة البيانات التجريبية', 'Reset demo data')}
          </button>
          <button className="btn ghost block" onClick={() => { A.signOut(); go('/', true); }}>
            <Icon name="logout" /> {L('تسجيل الخروج', 'Sign out')}
          </button>
          <button
            className="btn danger block"
            onClick={() => {
              if (!confirm(L('حذف كل البيانات من هذا الجهاز نهائياً؟ صدّر نسخة احتياطية أولاً.', 'Delete all data from this device? Export a backup first.'))) return;
              setDB({ ...emptyDB(), settings: { ...getDB().settings, pinHash: undefined, biometricId: undefined } });
              go('/', true);
            }}
          >
            {L('حذف بيانات هذا الجهاز', 'Erase device data')}
          </button>
        </section>
        <div className="tiny muted" style={{ textAlign: 'center' }}>
          {L('جمعيتي 1.0 — أداة تنظيم وتوثيق فقط. لا نحتفظ بالأموال ولا نحوّلها. بلا فوائد ولا رسوم ربوية.', 'Jamiyati 1.0 — organizing & documentation only. No money held, no interest.')}
        </div>
      </main>
      <PinSheet open={pinSheet} onClose={() => setPinSheet(false)} />
    </>
  );
}

function PinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={L('رمز القفل', 'Lock PIN')}>
      <div className="stack">
        <Field label={L('رمز من 4 أرقام', '4-digit PIN')}>
          <input className="input ltr num code" style={{ textAlign: 'center' }} inputMode="numeric" type="password" maxLength={4} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={L('تأكيد الرمز', 'Confirm PIN')}>
          <input className="input ltr num code" style={{ textAlign: 'center' }} inputMode="numeric" type="password" maxLength={4} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} />
        </Field>
        {b.length === 4 && a !== b && <div className="error small">{L('الرمزان غير متطابقين', "PINs don't match")}</div>}
        <button
          className="btn block"
          disabled={a.length !== 4 || a !== b}
          onClick={async () => {
            A.updateSettings({ pinHash: await sha256(a) });
            sessionStorage.setItem('jamiyati:unlocked', '1');
            toast(L('فُعّل القفل ✓', 'PIN lock enabled ✓'));
            setA('');
            setB('');
            onClose();
          }}
        >
          {L('حفظ', 'Save')}
        </button>
      </div>
    </Sheet>
  );
}
