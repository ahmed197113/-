// طابور العمليات بدون إنترنت (IndexedDB) والمزامنة عند عودة الاتصال
(function () {
  const DB = 'mawqii-offline';
  let dbp;
  function idb() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  async function store(mode) {
    return (await idb()).transaction('queue', mode).objectStore('queue');
  }
  const done = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  // يحوّل FormData إلى أجزاء قابلة للتخزين
  function fdParts(fd) {
    const parts = [];
    for (const [k, v] of fd.entries()) parts.push(v instanceof Blob ? { k, blob: v, name: v.name || 'file' } : { k, v });
    return parts;
  }
  function partsFd(parts) {
    const fd = new FormData();
    for (const p of parts) p.blob ? fd.append(p.k, p.blob, p.name) : fd.append(p.k, p.v);
    return fd;
  }

  const Offline = {
    async enqueue(item) {
      const rec = { ...item, created: Date.now() };
      if (item.form) { rec.parts = fdParts(item.form); delete rec.form; }
      await done((await store('readwrite')).add(rec));
      Offline.changed();
    },
    async all() {
      return done((await store('readonly')).getAll());
    },
    async count() {
      return done((await store('readonly')).count());
    },
    async remove(id) {
      await done((await store('readwrite')).delete(id));
    },
    syncing: false,
    // يرسل العمليات المؤجلة بالترتيب؛ يتوقف عند انقطاع الشبكة
    async sync(token) {
      if (Offline.syncing || !navigator.onLine || !token) return { sent: 0, failed: 0 };
      Offline.syncing = true;
      let sent = 0;
      let failed = 0;
      try {
        for (const it of await Offline.all()) {
          let res;
          try {
            const opts = { method: it.method || 'POST', headers: { Authorization: 'Bearer ' + token } };
            if (it.parts) opts.body = partsFd(it.parts);
            else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(it.body); }
            res = await fetch(it.url, opts);
          } catch {
            break; // ما زال بدون اتصال
          }
          if (res.status === 503) break;
          if (res.ok) sent++;
          else {
            failed++;
            const msg = (await res.json().catch(() => ({}))).error || res.status;
            Offline.failures.push({ label: it.label, error: msg });
          }
          await Offline.remove(it.id); // يُحذف بعد الإرسال (أو الرفض النهائي من الخادم)
        }
      } finally {
        Offline.syncing = false;
        Offline.changed();
      }
      return { sent, failed };
    },
    failures: [],
    changed() {},
  };
  window.Offline = Offline;
})();
