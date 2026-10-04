// صور الإثبات تُخزن في IndexedDB (سعة كبيرة) بدلاً من localStorage (حوالي 5MB فقط).
// الدفعة تحمل مرجعاً نصياً "idb:<key>"، والصور القديمة/التجريبية المضمّنة data: تبقى مدعومة.
import { useEffect, useState } from 'react';

const DB_NAME = 'jamiyati-proofs';
const STORE = 'proofs';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export const isProofRef = (s?: string) => !!s && s.startsWith('idb:');

/** يحفظ الصورة ويعيد مرجعها؛ عند تعذر IndexedDB تُعاد الصورة نفسها مضمّنة */
export async function storeProof(dataUrl: string): Promise<string> {
  if (typeof indexedDB === 'undefined') return dataUrl;
  try {
    const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await tx('readwrite', (s) => s.put(dataUrl, key));
    return `idb:${key}`;
  } catch {
    return dataUrl;
  }
}

export async function loadProof(ref?: string): Promise<string | undefined> {
  if (!ref) return undefined;
  if (!isProofRef(ref)) return ref;
  try {
    return (await tx<string | undefined>('readonly', (s) => s.get(ref.slice(4)))) ?? undefined;
  } catch {
    return undefined;
  }
}

export function useProof(ref?: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(isProofRef(ref) ? undefined : ref);
  useEffect(() => {
    let alive = true;
    loadProof(ref).then((v) => alive && setSrc(v));
    return () => {
      alive = false;
    };
  }, [ref]);
  return src;
}

/** كل الصور للنسخ الاحتياطي */
export async function allProofs(): Promise<Record<string, string>> {
  if (typeof indexedDB === 'undefined') return {};
  const db = await open();
  return new Promise((res, rej) => {
    const out: Record<string, string> = {};
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return res(out);
      out[String(c.key)] = c.value as string;
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

export async function restoreProofs(map: Record<string, string>) {
  for (const [k, v] of Object.entries(map)) await tx('readwrite', (s) => s.put(v, k));
}
