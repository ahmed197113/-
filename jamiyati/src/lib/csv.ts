// تصدير لتطبيقات الميزانية: القسط ← مصروف ثابت متكرر، الاستلام ← دخل متوقع
import type { DB } from '../domain/types';
import { calendarEvents, myCircles } from '../store/selectors';
import { monthlyEquivalent } from '../domain/calc';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCSV = (rows: (string | number)[][]) => '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');

/** كل الحركات (المدفوعة والمتوقعة) — صيغة مناسبة لـ Excel وتطبيقات الميزانية */
export function transactionsCSV(db: DB, userId: string, today: string): string {
  const rows: (string | number)[][] = [['Date', 'Type', 'Category', 'Amount', 'Currency', 'Circle', 'Cycle', 'Status', 'Description']];
  for (const e of calendarEvents(db, userId, today)) {
    const expense = e.kind === 'pay';
    rows.push([
      e.date,
      expense ? 'Expense' : 'Income',
      expense ? 'Savings Circle Installment' : 'Savings Circle Payout',
      expense ? -e.amount : e.amount,
      e.currency,
      e.circleName,
      e.cycleIndex + 1,
      expense ? (e.status === 'paid' ? 'Cleared' : e.date < today ? 'Overdue' : 'Scheduled') : e.date <= today ? 'Expected/Received' : 'Expected',
      expense ? `قسط ${e.circleName} — الدورة ${e.cycleIndex + 1}` : `استلام ${e.circleName}`,
    ]);
  }
  return toCSV(rows);
}

/** الالتزامات المتكررة: صف لكل جمعية كمصروف ثابت، وصف لكل استلام كدخل متوقع */
export function recurringCSV(db: DB, userId: string, today: string): string {
  const rows: (string | number)[][] = [['Name', 'Type', 'Amount', 'Currency', 'Frequency', 'Start', 'End', 'Monthly Equivalent']];
  for (const c of myCircles(db, userId, today)) {
    if (c.view.circle.status !== 'active' && c.view.circle.status !== 'draft') continue;
    const s = c.view.schedule;
    rows.push([`قسط ${c.view.circle.name}`, 'Fixed Expense', c.duePerCycle, c.view.circle.currency, c.view.circle.frequency, s[0]?.dueDate, s.at(-1)?.dueDate ?? '', monthlyEquivalent(c.duePerCycle, c.view.circle.frequency)]);
    for (const t of c.myTurns.filter((x) => !x.received)) rows.push([`استلام ${c.view.circle.name}`, 'Expected Income', t.amount, c.view.circle.currency, 'once', t.date, t.date, '']);
  }
  return toCSV(rows);
}
