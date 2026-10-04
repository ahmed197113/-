// محرك التذكيرات: يعمل عند فتح التطبيق ويومياً، ويولّد إشعارات مرة واحدة لكل (جمعية، دورة، نوع).
// في الإنتاج: نفس المنطق يعمل كـ Supabase Edge Function مجدولة (cron) ويرسل Web Push.
import { reminderFor } from '../domain/calc';
import { addDays, todayISO } from '../domain/dates';
import type { DB } from '../domain/types';
import { mutate, nowISO, uid } from '../store/db';
import { circleView, cycleSummary, myCircles } from '../store/selectors';
import { L } from './i18n';
import { money, date } from './format';

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

/** إشعار نظام عبر Service Worker إن منح المستخدم الإذن */
export async function showSystemNotifications(texts: string[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  for (const body of texts.slice(0, 3)) reg?.showNotification(L('جمعيتي', 'Jamiyati'), { body, icon: 'icon.svg', dir: 'auto', lang: 'ar' });
}
