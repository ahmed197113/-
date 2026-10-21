// التشغيل على الجهاز بدون خادم: نفس منطق الخادم (core.js) مع تخزين IndexedDB
'use strict';
(function () {
  function idb(name) {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  const op = (db, store, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  });

  const enc = new TextEncoder();
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function pbkdf2(password, salt) {
    if (!crypto.subtle) return 'plain:' + password;
    const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 60000, hash: 'SHA-256' }, key, 256));
  }
  const rid = () => hex(crypto.getRandomValues(new Uint8Array(8)));

  /** ينشئ واجهة api مطابقة للخادم. dbName يميز البيانات الحقيقية عن التجريبية. */
  async function createLocalBackend(dbName, { demo } = {}) {
    const C = window.CustodyCore;
    const store = await idb(dbName);
    let saveTimer = null;
    const env = {
      db: C.normalize(await op(store, 'kv', 'readonly', s => s.get('db'))),
      save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => op(store, 'kv', 'readwrite', s => s.put(env.db, 'db')).catch(e => console.error(e)), 30);
      },
      uid: rid,
      now: () => new Date().toISOString(),
      today: () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); },
      async hashPassword(pw) { const salt = rid(); return { salt, hash: await pbkdf2(pw, salt) }; },
      async verifyPassword(u, pw) { return !!u.salt && (await pbkdf2(pw, u.salt)) === u.hash; },
      async putFile(dataUrl) {
        if (!/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(dataUrl)) throw new C.ApiError(400, 'صيغة المرفق غير مدعومة');
        const id = rid();
        await op(store, 'files', 'readwrite', s => s.put(dataUrl, id));
        return id;
      },
    };
    let core = C.createCore(env);
    if (demo && core.needsSetup()) { await C.seedDemo(env); await op(store, 'kv', 'readwrite', s => s.put(env.db, 'db')); }

    const userOf = token => {
      const id = env.db.sessions[token];
      const u = id && env.db.users.find(x => x.id === id && x.active !== false);
      if (!u) throw new C.ApiError(401, 'يجب تسجيل الدخول');
      return u;
    };
    const session = u => { const token = rid() + rid(); env.db.sessions[token] = u.id; env.save(); return { token, user: core.publicUser(u) }; };
    const clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));

    return {
      mode: demo ? 'demo' : 'local',
      async api(method, url, body, token) {
        const [path, qs] = url.split('?');
        if (path === '/api/status') return { needsSetup: core.needsSetup(), mode: demo ? 'demo' : 'local', companyName: env.db.settings.companyName };
        if (path === '/api/setup') return session(await core.setup(body || {}));
        if (path === '/api/login') return session(await core.login(body.username, body.password));
        const user = userOf(token);
        if (path === '/api/logout') { delete env.db.sessions[token]; env.save(); return { ok: true }; }
        if (path === '/api/restore') {
          if (user.role !== 'admin') throw new C.ApiError(403, 'لمدير النظام فقط');
          if (!body || !Array.isArray(body.users) || !body.users.length) throw new C.ApiError(400, 'ملف النسخة الاحتياطية غير صالح');
          const sessions = env.db.sessions;
          const files = body.__files || {};
          delete body.__files;
          env.db = C.normalize(body);
          env.db.sessions = sessions;
          for (const [id, data] of Object.entries(files)) await op(store, 'files', 'readwrite', s => s.put(data, id));
          core = C.createCore(env);
          env.save();
          return { ok: true };
        }
        const m = /^\/api\/files\/([\w.]+)$/.exec(path);
        if (m) return op(store, 'files', 'readonly', s => s.get(m[1]));
        const result = await core.handle(method, path, Object.fromEntries(new URLSearchParams(qs || '')), clone(body) || {}, user);
        if (path === '/api/backup') {
          // النسخة الاحتياطية المحلية تتضمن المرفقات
          const files = {};
          const ids = [...env.db.expenses.flatMap(e => e.attachments || []), ...env.db.assets.flatMap(a => a.photos || [])];
          for (const id of ids) files[id] = await op(store, 'files', 'readonly', s => s.get(id));
          return { ...clone(result), __files: files };
        }
        return clone(result);
      },
      async fileSrc(id) { return op(store, 'files', 'readonly', s => s.get(id)); },
      async wipe() { await op(store, 'kv', 'readwrite', s => s.clear()); await op(store, 'files', 'readwrite', s => s.clear()); },
    };
  }
  window.createLocalBackend = createLocalBackend;
})();
