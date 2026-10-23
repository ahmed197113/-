'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/app');
const { seed } = require('../server/seed');
const util = require('../server/util');

// يوم عمل ثابت (الأربعاء) لتكون الاختبارات مستقلة عن تاريخ التشغيل
function setClock(iso) {
  util.clock.now = () => new Date(iso);
}

async function start({ withSeed = true, at = '2026-10-21T05:00:00Z' } = {}) {
  setClock(at);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mawqii-test-'));
  const { app, db } = createApp({ dbFile: ':memory:', dataDir });
  if (withSeed) seed(db);
  const server = await new Promise((res) => {
    const s = app.listen(0, () => res(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const tokens = {};

  async function call(user, method, url, body, { raw = false } = {}) {
    const headers = {};
    if (user) {
      if (!tokens[user]) {
        const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: '123456' }) });
        tokens[user] = (await r.json()).token;
      }
      headers.Authorization = `Bearer ${tokens[user]}`;
    }
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers, body: payload });
    if (raw) return res;
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  return {
    db, base, call, tokens,
    get: (u, url) => call(u, 'GET', url),
    post: (u, url, b) => call(u, 'POST', url, b ?? {}),
    put: (u, url, b) => call(u, 'PUT', url, b ?? {}),
    async stop() {
      await new Promise((r) => server.close(r));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

module.exports = { start, setClock };
