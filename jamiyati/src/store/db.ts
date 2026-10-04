// طبقة التخزين: محلية أولاً (localStorage) مع واجهة موحدة يسهل استبدالها بـ Supabase.
// كل التعديلات تمر عبر mutate() لضمان الحفظ وإشعار الواجهة.
import { useSyncExternalStore } from 'react';
import type { ActivityEntry, DB, Settings } from '../domain/types';
import { allProofs, restoreProofs } from '../lib/proofs';

const KEY = 'jamiyati:db:v1';
export const DB_VERSION = 1;

export const defaultSettings: Settings = {
  lang: 'ar',
  theme: 'system',
  calendar: 'gregory',
  digits: 'latn',
  fontScale: 1,
  premium: true, // نسخة شخصية: كل المزايا مفعلة. نموذج الربح (حدود الخطة المجانية) موجود ويُفعَّل بجعلها false
  onboarded: false,
};

export function emptyDB(): DB {
  return {
    version: DB_VERSION,
    users: [],
    circles: [],
    members: [],
    shares: [],
    payments: [],
    payouts: [],
    swaps: [],
    log: [],
    notifications: [],
    settings: { ...defaultSettings },
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as DB;
    return { ...emptyDB(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
  } catch {
    return emptyDB();
  }
}

let state: DB = typeof localStorage !== 'undefined' ? load() : emptyDB();
const listeners = new Set<() => void>();

export function getDB(): DB {
  return state;
}

export function setDB(next: DB) {
  state = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('تعذر الحفظ', e);
      alert('تعذر حفظ البيانات: مساحة التخزين ممتلئة. احذف بعض صور الإثبات أو صدّر نسخة احتياطية.');
    }
  }
  listeners.forEach((l) => l());
}

/** ينسخ الحالة سطحياً ويمرر نسخة قابلة للتعديل */
export function mutate(fn: (db: DB) => void) {
  const draft: DB = {
    ...state,
    users: [...state.users],
    circles: [...state.circles],
    members: [...state.members],
    shares: [...state.shares],
    payments: [...state.payments],
    payouts: [...state.payouts],
    swaps: [...state.swaps],
    log: [...state.log],
    notifications: [...state.notifications],
    settings: { ...state.settings },
  };
  fn(draft);
  setDB(draft);
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getDB);
}

export const uid = (p = '') =>
  p + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));

export const nowISO = () => new Date().toISOString();

// ───────── سجل النشاط: إضافة فقط، بسلسلة تجزئة لاكتشاف أي تعديل ─────────

/** cyrb53: تجزئة سريعة متزامنة. في الإنتاج تُحسب SHA-256 على الخادم داخل trigger. */
export function hashStr(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

function entryPayload(e: Omit<ActivityEntry, 'hash'>) {
  return [e.id, e.circleId, e.at, e.actorId, e.type, e.message, e.prevHash].join('|');
}

export function appendLog(db: DB, circleId: string, actorId: string, type: string, message: string, at = nowISO()) {
  const prev = [...db.log].reverse().find((e) => e.circleId === circleId);
  const actor = db.users.find((u) => u.id === actorId);
  const partial = {
    id: uid('l_'),
    circleId,
    at,
    actorId,
    actorName: actor?.name ?? 'النظام',
    type,
    message,
    prevHash: prev?.hash ?? '0',
  };
  db.log.push({ ...partial, hash: hashStr(entryPayload(partial)) });
}

/** يتحقق من سلامة سلسلة السجل لجمعية: يرجع رقم أول قيد معطوب أو -1 */
export function verifyLog(entries: ActivityEntry[]): number {
  let prev = '0';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev || hashStr(entryPayload(e)) !== e.hash) return i;
    prev = e.hash;
  }
  return -1;
}

/** نسخة احتياطية كاملة تشمل صور الإثبات المخزنة في IndexedDB */
export async function exportBackup(): Promise<string> {
  const proofs = await allProofs().catch(() => ({}));
  return JSON.stringify({ ...state, proofs });
}

export async function importBackup(json: string) {
  const parsed = JSON.parse(json) as DB & { proofs?: Record<string, string> };
  if (!parsed || !Array.isArray(parsed.circles) || !Array.isArray(parsed.payments)) throw new Error('ملف غير صالح');
  if (parsed.proofs) await restoreProofs(parsed.proofs);
  delete parsed.proofs;
  setDB({ ...emptyDB(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } });
}
