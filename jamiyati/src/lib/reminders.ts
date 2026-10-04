// محرك التذكيرات: يعمل عند فتح التطبيق ويومياً، ويولّد إشعارات مرة واحدة لكل (جمعية، دورة، نوع).
// في الإنتاج: نفس المنطق يعمل كـ Supabase Edge Function مجدولة (cron) ويرسل Web Push.
import { reminderFor } from '../domain/calc';
import { addDays, parseISODate, todayISO } from '../domain/dates';
import type { DB } from '../domain/types';
import { mutate, nowISO, uid } from '../store/db';
import { circleView, cycleSummary, myCircles } from '../store/selectors';
import { L } from './i18n';
import { money, date } from './format';
import { native, scheduleNative, type ScheduledReminder } from './native';

export function runReminders(db: DB, today = todayISO()) {
  const userId = db.currentUserId;
  if (!userId) return;
  const fresh: DB['notifications'] = [];
  const push = (circleId: string, kind: DB['notifications'][number]['kind'], text: string, key: string) => {
    if (db.notifications.some((n) => n.userId === userId && n.key === key) || fresh.some((n) => n.key === key)) return;
    fresh.push({ id: uid('n_'), userId, circleId, at: nowISO(), kind, text, read: false, key });
  };

  for (const card of myCircles(db, userId, today)) {
    const { circle, schedule } = card.view;
    if (circle.status !== 'active') continue;
    const row = card.view.rows.find((r) => r.member.id === card.member.id);
    // تذكيرات العضو
    if (row) {
      schedule.forEach((cy, i) => {
        const kind = reminderFor(cy, today, row.cells[i].status === 'paid' || row.cells[i].status === 'pending');
        if (!kind) return;
        const amt = money(row.cells[i].remaining, circle.currency);
        const text =
          kind === 'before3'
            ? L(`قسط "${circle.name}" (${amt}) بعد 3 أيام — ${date(cy.dueDate)}`, `"${circle.name}" installment (${amt}) due in 3 days`)
            : kind === 'dueDay'
              ? L(`اليوم موعد قسط "${circle.name}" (${amt})`, `"${circle.name}" installment (${amt}) is due today`)
              : L(`قسط "${circle.name}" للدورة ${i + 1} متأخر (${amt})`, `"${circle.name}" cycle ${i + 1} installment is late (${amt})`);
        push(circle.id, 'reminder', text, `${circle.id}:${i}:${kind}`);
      });
    }
    // إشعار الدور للجميع يوم الاستحقاق
    const cur = card.view.current;
    if (cur >= 0) {
      const s = cycleSummary(card.view, cur);
      if (s.recipients.length)
        push(
          circle.id,
          'turn',
          L(`دور ${s.recipients.map((r) => r.name).join(' و')} في "${circle.name}" هذه الدورة، المبلغ: ${money(card.view.pot, circle.currency)}`, `It's ${s.recipients.map((r) => r.name).join(' & ')}'s turn in "${circle.name}"`),
          `${circle.id}:${cur}:turn`,
        );
    }
    // ملخص للمنظم قبل كل دورة (قبل 3 أيام) وبعد انتهاء المهلة
    if (card.role === 'organizer' || card.role === 'assistant') {
      const v = circleView(db, circle.id, today)!;
      const upcoming = schedule.find((cy) => cy.dueDate >= today && cy.dueDate <= addDays(today, 3));
      if (upcoming) {
        const s = cycleSummary(v, upcoming.index);
        push(
          circle.id,
          'summary',
          L(`ملخص "${circle.name}" قبل الدورة ${upcoming.index + 1}: دفع ${s.paid.length} من ${v.rows.length}، بانتظار التأكيد ${s.pending.length}، متأخر ${s.late.length}`, `"${circle.name}" summary before cycle ${upcoming.index + 1}`),
          `${circle.id}:${upcoming.index}:summary`,
        );
      }
      const lateNow = v.rows.filter((r) => r.cells.some((c) => c.status === 'late'));
      if (lateNow.length)
        push(circle.id, 'summary', L(`في "${circle.name}" ${lateNow.length} أعضاء متأخرون: ${lateNow.map((r) => r.member.name).join('، ')}`, `${lateNow.length} late members in "${circle.name}"`), `${circle.id}:${today}:late-summary`);
    }
  }
  if (fresh.length) {
    mutate((d) => {
      d.notifications.push(...fresh);
    });
    showSystemNotifications(fresh.map((n) => n.text));
  }
}

/** إشعار نظام: في التطبيق الأصلي عبر أندرويد، وفي المتصفح عبر Service Worker إن منح المستخدم الإذن */
export async function showSystemNotifications(texts: string[]) {
  const n = native();
  if (n) {
    if (n.notificationPermission() === 'granted') for (const body of texts.slice(0, 3)) n.notify(L('جمعيتي', 'Jamiyati'), body);
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  for (const body of texts.slice(0, 3)) reg?.showNotification(L('جمعيتي', 'Jamiyati'), { body, icon: 'icon.svg', dir: 'auto', lang: 'ar' });
}

/** وقت محلي على تاريخ معين */
function at(iso: string, hour: number): number {
  const d = parseISODate(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0).getTime();
}

/**
 * يحسب التذكيرات القادمة (60 يوماً) ويجدولها في نظام أندرويد لتصل والتطبيق مغلق.
 * يُستدعى عند كل فتح وبعد كل تعديل؛ الجدولة الجديدة تستبدل القديمة (من دفع لا يصله تذكير).
 */
export function upcomingReminders(db: DB, today = todayISO(), now = Date.now()): ScheduledReminder[] {
  const userId = db.currentUserId;
  if (!userId) return [];
  const horizon = now + 60 * 86_400_000;
  const out: ScheduledReminder[] = [];
  const add = (id: string, t: number, body: string) => {
    if (t > now && t < horizon) out.push({ id, at: t, title: L('جمعيتي', 'Jamiyati'), body });
  };
  for (const card of myCircles(db, userId, today)) {
    const { circle, schedule } = card.view;
    if (circle.status !== 'active') continue;
    const row = card.view.rows.find((r) => r.member.id === card.member.id);
    schedule.forEach((cy, i) => {
      if (row) {
        const cell = row.cells[i];
        if (cell.status !== 'paid' && cell.status !== 'pending') {
          const amt = money(cell.remaining, circle.currency);
          add(`${circle.id}:${i}:before3`, at(addDays(cy.dueDate, -3), 9), L(`قسط "${circle.name}" (${amt}) بعد 3 أيام — ${date(cy.dueDate)}`, `"${circle.name}" (${amt}) due in 3 days`));
          add(`${circle.id}:${i}:dueDay`, at(cy.dueDate, 9), L(`اليوم موعد قسط "${circle.name}" (${amt})`, `"${circle.name}" installment due today`));
          add(`${circle.id}:${i}:late`, at(addDays(cy.lateAfter, 1), 10), L(`قسط "${circle.name}" للدورة ${i + 1} متأخر (${amt}) — ادفع وارفع الإثبات`, `"${circle.name}" cycle ${i + 1} is late`));
        }
      }
      const s = cycleSummary(card.view, i);
      if (s.recipients.length)
        add(`${circle.id}:${i}:turn`, at(cy.dueDate, 12), L(`دور ${s.recipients.map((r) => r.name).join(' و')} في "${circle.name}" اليوم، المبلغ ${money(card.view.pot, circle.currency)}`, `Turn day in "${circle.name}"`));
      if (card.role !== 'member')
        add(`${circle.id}:${i}:summary`, at(addDays(cy.dueDate, -3), 20), L(`"${circle.name}": الدورة ${i + 1} بعد 3 أيام — راجع من دفع ومن بقي`, `"${circle.name}": cycle ${i + 1} in 3 days`));
    });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}

export function syncNativeSchedule(db: DB) {
  if (!native()) return;
  scheduleNative(upcomingReminders(db));
}
