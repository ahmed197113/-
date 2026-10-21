// يقارن ردود خادم Node وخادم PHP على نفس البيانات التجريبية
const [A, B] = process.argv.slice(2);
const DROP = process.env.STRICT ? /^(token|lastCheckin|last)$/ : /^(id|.*By|.*Id|.*Ids|at|createdAt|reviewedAt|closedAt|decidedAt|acknowledgedAt|lastCheckin|hash|salt|last|link|time|token)$/;
async function client(base) {
  const call = async (m, p, body, token) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const login = async (u, pw) => (await call('POST', '/api/login', { username: u, password: pw })).data.token;
  return { call, login };
}
function norm(v) {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) if (!DROP.test(k) && v[k] !== undefined && v[k] !== null) o[k] = norm(v[k]); return o; }
  return v;
}
function diff(a, b, path, out) {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-9) out.push(`${path}: ${a} != ${b}`); return; }
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) out.push(`${path}: length ${a.length} != ${b.length}`); for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out); return; }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}
(async () => {
  const sides = await Promise.all([A, B].map(async base => {
    const c = await client(base);
    const t = { admin: await c.login('admin', 'admin') };
    for (const u of ['sara', 'mohamed', 'khaled', 'omar']) t[u] = await c.login(u, '1234');
    const boot = (await c.call('GET', '/api/bootstrap', null, t.admin)).data;
    const uid = n => boot.users.find(u => u.username === n).id;
    const cc = code => boot.costCenters.find(x => x.code === code).id;
    const src = i => boot.fundSources[i].id;
    const custs = (await c.call('GET', '/api/custodies', null, t.admin)).data;
    const res = {};
    const get = async (key, p, who = 'admin') => { res[key] = await c.call('GET', p, null, t[who]); };
    await get('bootstrap', '/api/bootstrap'); await get('bootstrap-emp', '/api/bootstrap', 'mohamed');
    await get('dashboard', '/api/dashboard');
    for (const r of ['balances', 'cost-centers', 'categories', 'expenses', 'vat', 'aging', 'assets', 'settlements', 'sources', 'source-ledger', 'checkins']) await get('report-' + r, '/api/reports/' + r);
    for (const u of ['mohamed', 'khaled', 'omar']) { await get('statement-' + u, '/api/reports/statement?employeeId=' + uid(u)); await get('statement-self-' + u, '/api/reports/statement', u); }
    const d = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10);
    await get('statement-from', `/api/reports/statement?employeeId=${uid('mohamed')}&from=${d}`);
    await get('categories-cc', '/api/reports/categories?costCenterId=' + cc('P-101'));
    await get('cost-centers-approved', '/api/reports/cost-centers?status=approved&from=' + d);
    await get('source-ledger-bank', '/api/reports/source-ledger?sourceId=' + src(1));
    await get('expenses-filter', `/api/reports/expenses?costCenterId=${cc('P-101')}&q=%D8%AF%D9%87`);
    await get('cc-detail', '/api/cost-centers/' + cc('P-101'));
    await get('cc-detail2', '/api/cost-centers/' + cc('G-900'));
    await get('custodies', '/api/custodies'); await get('custodies-overdue', '/api/custodies?status=open&flag=overdue');
    for (const x of custs) await get('custody-' + x.no, '/api/custodies/' + x.id);
    await get('expenses', '/api/expenses'); await get('requests', '/api/requests'); await get('assets', '/api/assets'); await get('audit', '/api/audit');
    for (const u of ['admin', 'mohamed', 'khaled', 'omar']) await get('notif-' + u, '/api/notifications', u);
    for (const u of ['mohamed', 'khaled', 'omar']) { await get('home-' + u, '/api/home', u); await get('exp-' + u, '/api/expenses', u); await get('cust-' + u, '/api/custodies', u); }
    await get('statement-emp-forbidden', '/api/reports/balances', 'mohamed');
    await get('backup', '/api/backup');
    return res;
  }));
  let bad = 0;
  for (const k of Object.keys(sides[0])) {
    const out = [];
    if (sides[0][k].status !== sides[1][k].status) out.push(`status ${sides[0][k].status} != ${sides[1][k].status}`);
    const unordered = !process.env.STRICT && /^(notif|audit|assets)/.test(k);
    const prep = v => { v = norm(v); if (!process.env.STRICT && k === "dashboard") v.recent = v.recent.map(x => JSON.stringify(x)).sort(); return unordered && Array.isArray(v) ? v.map(x => JSON.stringify(x)).sort() : v; };
    diff(prep(sides[0][k].data), prep(sides[1][k].data), k, out);
    if (out.length) { bad++; console.log('✗', k, '\n  ' + out.slice(0, 12).join('\n  ')); } else console.log('✓', k);
  }
  console.log(bad ? `${bad} مختلفة` : 'كل الردود متطابقة');
  process.exit(bad ? 1 : 0);
})();
