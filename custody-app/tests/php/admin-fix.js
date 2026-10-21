// سيناريو اختبار التعديل والحذف لمدير النظام — يُشغَّل على خادم Node وخادم PHP وتُقارن النتائج
const base = process.argv[2];
const out = [];
let token = '';
async function api(method, path, body, tk = token) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...((j && typeof j === 'object' && !Array.isArray(j)) ? j : { list: j }) };
}
const rec = (label, v) => out.push(label + ': ' + JSON.stringify(v));
const bal = c => ({ received: c.received, spent: c.received !== undefined ? c.spent : undefined, returned: c.returned, balance: c.balance, status: c.status });
(async () => {
  token = (await api('POST', '/api/login', { username: 'admin', password: 'admin' })).token;
  const emp = (await api('POST', '/api/login', { username: 'mohamed', password: '1234' })).token;
  const boot = await api('GET', '/api/bootstrap');
  const users = boot.users, U = n => users.find(u => u.username === n);
  const src = boot.fundSources[0].id, cc = boot.costCenters[0].id, cat = boot.categories[0].id;

  // 1) عهدة بمبلغ خاطئ 10000 ثم تصحيحه إلى 1000
  let c = await api('POST', '/api/custodies', { employeeId: U('omar').id, kind: 'temporary', amount: 10000, purpose: 'اختبار خطأ', costCenterId: cc, sourceId: src, force: true });
  rec('created', bal(c));
  rec('employee cannot fix', (await api('PUT', '/api/custodies/' + c.id, { amount: 1000 }, emp)).status);
  c = await api('PUT', '/api/custodies/' + c.id, { amount: 1000, employeeId: U('khaled').id, kind: 'permanent' });
  rec('fixed', { ...bal(c), employeeName: c.employeeName, kind: c.kind });

  // 2) مصروف ثم تسوية وإغلاق ثم تعديل مصروف مسوى والتراجع عن التسوية
  const e = await api('POST', '/api/expenses', { custodyId: c.id, categoryId: cat, costCenterId: cc, amount: 300, description: 'بند', autoApprove: true });
  const st = await api('POST', '/api/custodies/' + c.id + '/settle', { close: true, sourceId: src });
  rec('settled', { total: st.settlement.total, returned: st.settlement.returned, ...bal(st.custody) });
  const e2 = await api('PUT', '/api/expenses/' + e.id, { amount: 250 });
  rec('edit settled expense', { status: e2.status, amount: e2.amount });
  let d = await api('GET', '/api/custodies/' + c.id);
  rec('after settled edit', { ...bal(d.custody), stTotal: d.settlements[0].total });
  const retTx = d.tx.find(t => t.type === 'return');
  d.custody = await api('PUT', '/api/tx/' + retTx.id, { amount: 750 });
  rec('tx fix', bal(d.custody));
  const undo = await api('DELETE', '/api/settlements/' + st.settlement.id);
  rec('undo settlement', bal(undo));
  d = await api('GET', '/api/custodies/' + c.id);
  rec('after undo', { tx: d.tx.map(t => t.type + ':' + t.amount), settled: d.expenses.map(x => !!x.settlementId), settlements: d.settlements.length });
  rec('delete issue tx blocked', (await api('DELETE', '/api/tx/' + d.tx[0].id)).status);

  // 3) تحويل ثم حذف الحركة (تُحذف معها المقابلة)
  await api('POST', '/api/custodies/' + c.id + '/tx', { type: 'transfer', amount: 100, toEmployeeId: U('omar').id });
  d = await api('GET', '/api/custodies/' + c.id);
  const tout = d.tx.find(t => t.type === 'transfer_out');
  rec('delete transfer', bal(await api('DELETE', '/api/tx/' + tout.id)));
  const allTx = (await api('GET', '/api/reports/source-ledger')).rows;
  rec('ledger rows', allTx.length);

  // 4) حذف العهدة كاملة
  rec('employee cannot delete custody', (await api('DELETE', '/api/custodies/' + c.id, null, emp)).status);
  rec('delete custody', (await api('DELETE', '/api/custodies/' + c.id)).ok);
  rec('custody gone', (await api('GET', '/api/custodies/' + c.id)).status);

  // 5) المستخدمون والبيانات الأساسية
  const t = await api('POST', '/api/users', { name: 'تجربة', username: 'test', password: '1234', role: 'employee' });
  await api('POST', '/api/custodies', { employeeId: t.id, amount: 500, purpose: 'تجربة', sourceId: src, force: true });
  rec('delete user with custody', (await api('DELETE', '/api/users/' + t.id)).status);
  rec('purge user', (await api('DELETE', '/api/users/' + t.id + '?purge=1')).ok);
  const me = boot.user.id;
  rec('delete self', (await api('DELETE', '/api/users/' + me)).status);
  rec('delete used category', (await api('DELETE', '/api/categories/' + cat)).status);
  const nc = await api('POST', '/api/categories', { name: 'بند خطأ' });
  rec('delete unused category', (await api('DELETE', '/api/categories/' + nc.id)).ok);
  const ns = await api('POST', '/api/sources', { name: 'مصدر خطأ' });
  rec('delete unused source', (await api('DELETE', '/api/sources/' + ns.id)).ok);
  rec('delete used cc', (await api('DELETE', '/api/cost-centers/' + cc)).status);
  const reqs = (await api('GET', '/api/requests')).list;
  rec('delete request', (await api('DELETE', '/api/requests/' + reqs[0].id)).ok);
  const assets = (await api('GET', '/api/assets')).list;
  rec('delete asset', (await api('DELETE', '/api/assets/' + assets[0].id)).ok);
  rec('balances total', (await api('GET', '/api/reports/balances')).totals);
  rec('audit', (await api('GET', '/api/audit')).list.slice(0, 14).map(a => a.action + ' | ' + a.summary.replace(/(CU|ST|EX)-\d+/g, '$1')));
  console.log(out.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
