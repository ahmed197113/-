import { useEffect, useState } from 'react';
import { todayISO } from './domain/dates';
import { L, setLang } from './lib/i18n';
import { runReminders, syncNativeSchedule } from './lib/reminders';
import { getDB, useDB } from './store/db';
import { Icon } from './ui/components/Icon';
import { Toaster } from './ui/components/ui';
import { useRoute } from './ui/router';
import { LockScreen } from './ui/screens/Lock';
import { Welcome, Login } from './ui/screens/Auth';
import { Home } from './ui/screens/Home';
import { Wizard } from './ui/screens/Wizard';
import { Join } from './ui/screens/Join';
import { CircleScreen } from './ui/screens/Circle';
import { MemberScreen } from './ui/screens/Member';
import { Lottery } from './ui/screens/Lottery';
import { Receipt } from './ui/screens/Receipt';
import { Report } from './ui/screens/Report';
import { CalendarScreen } from './ui/screens/Calendar';
import { Notifications } from './ui/screens/Notifications';
import { CirclesScreen } from './ui/screens/Circles';
import { Tools } from './ui/screens/Tools';
import { SettingsScreen } from './ui/screens/Settings';

const UNLOCK_KEY = 'jamiyati:unlocked';

function sessionUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function App() {
  const db = useDB();
  const { settings } = db;
  setLang(settings.lang);
  const { parts } = useRoute();
  const [unlockedState, setUnlocked] = useState(false);
  // يُقرأ في كل عرض: تفعيل القفل من الإعدادات يعلّم الجلسة كمفتوحة فلا يظهر القفل فوراً
  const unlocked = unlockedState || sessionUnlocked();

  useEffect(() => {
    const el = document.documentElement;
    if (settings.theme === 'system') delete el.dataset.theme;
    else el.dataset.theme = settings.theme;
    el.style.setProperty('--fs', `${17 * settings.fontScale}px`);
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1412' : '#0f766e');
  }, [settings.theme, settings.fontScale]);

  // في تطبيق أندرويد: إعادة جدولة التذكيرات بعد كل تغيير في البيانات (مؤجلة قليلاً)
  useEffect(() => {
    if (!db.currentUserId) return;
    const id = setTimeout(() => syncNativeSchedule(getDB()), 800);
    return () => clearTimeout(id);
  }, [db]);

  // التذكيرات: عند الفتح، وعند العودة للتطبيق، وكل ساعة
  useEffect(() => {
    if (!db.currentUserId) return;
    const run = () => runReminders(getDB(), todayISO());
    run();
    const id = setInterval(run, 3_600_000);
    const vis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [db.currentUserId]);

  if ((settings.pinHash || settings.biometricId) && !unlocked && db.currentUserId) {
    return (
      <LockScreen
        onUnlock={() => {
          try {
            sessionStorage.setItem(UNLOCK_KEY, '1');
          } catch {
            /* وضع التصفح الخاص */
          }
          setUnlocked(true);
        }}
      />
    );
  }

  const [p0, p1, p2, p3] = parts;
  let screen: React.ReactNode;
  let nav = true;

  if (!db.currentUserId) {
    nav = false;
    if (p0 === 'login') screen = <Login />;
    else if (p0 === 'tools') screen = <Tools />;
    else screen = <Welcome />;
  } else if (p0 === 'new') {
    screen = <Wizard />;
    nav = false;
  } else if (p0 === 'join') screen = <Join code={p1} />;
  else if (p0 === 'c' && p1 && p2 === 'm' && p3) screen = <MemberScreen circleId={p1} memberId={p3} />;
  else if (p0 === 'c' && p1 && p2 === 'lottery') {
    screen = <Lottery circleId={p1} />;
    nav = false;
  } else if (p0 === 'c' && p1 && p2 === 'report') screen = <Report circleId={p1} />;
  else if (p0 === 'c' && p1) screen = <CircleScreen circleId={p1} />;
  else if (p0 === 'r' && p1) screen = <Receipt paymentId={p1} />;
  else if (p0 === 'calendar') screen = <CalendarScreen />;
  else if (p0 === 'notifications') screen = <Notifications />;
  else if (p0 === 'circles') screen = <CirclesScreen />;
  else if (p0 === 'tools') screen = <Tools />;
  else if (p0 === 'settings') screen = <SettingsScreen />;
  else screen = <Home />;

  const unread = db.notifications.filter((n) => n.userId === db.currentUserId && !n.read).length;

  return (
    <div className="app">
      {screen}
      {nav && db.currentUserId && (
        <nav className="nav no-print" aria-label={L('التنقل الرئيسي', 'Main navigation')}>
          <div className="nav-inner">
            <NavLink to="/" icon="home" label={L('الرئيسية', 'Home')} on={!p0 || p0 === 'notifications'} badge={unread} />
            <NavLink to="/circles" icon="users" label={L('جمعياتي', 'Circles')} on={p0 === 'circles' || p0 === 'c' || p0 === 'r'} />
            <NavLink to="/new" icon="plus" label={L('جديدة', 'New')} on={false} fab />
            <NavLink to="/calendar" icon="cal" label={L('التقويم', 'Calendar')} on={p0 === 'calendar'} />
            <NavLink to="/settings" icon="gear" label={L('حسابي', 'Account')} on={p0 === 'settings' || p0 === 'tools'} />
          </div>
        </nav>
      )}
      <Toaster />
    </div>
  );
}

function NavLink({ to, icon, label, on, fab, badge }: { to: string; icon: string; label: string; on: boolean; fab?: boolean; badge?: number }) {
  return (
    <a href={'#' + to} className={`${on ? 'on' : ''} ${fab ? 'fab' : ''}`} aria-current={on ? 'page' : undefined}>
      <span className="ic" style={{ position: 'relative' }}>
        <Icon name={icon} size={fab ? 24 : 24} />
        {!!badge && (
          <span className="dot" style={{ insetBlockStart: -6, insetInlineEnd: -10 }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {label}
    </a>
  );
}
