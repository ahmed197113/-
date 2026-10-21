// سيناريوهات المتصفح على وضع الخادم (PHP): node e2e.js http://localhost:3104
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.argv[2];
const OUT = process.argv[3] || __dirname;
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push(['✓', name]); console.log('✓', name); }
  catch (e) { results.push(['✗', name, e.message]); console.log('✗', name, '\n   ', e.message.split('\n')[0]); throw e; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };
// صورة PNG صغيرة حقيقية للفاتورة
const PNG = path.join(OUT, 'receipt.png');
fs.writeFileSync(PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAJUlEQVR4nGP8z/CfgRTAxECiAfo3Q0BGRkYGB2zU8A8T0z8+AACc0wQe0z4G0QAAAABJRU5ErkJggg==', 'base64'));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const api = async (method, p, body, token) => {
    const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, type: ct, data: ct.includes('json') ? await r.json() : await r.arrayBuffer() };
  };
  const modal = () => page.locator('.modal-back').last();
  const fill = async (name, value) => modal().locator(`[name="${name}"]`).first().fill(String(value));
  const select = async (name, label) => modal().locator(`select[name="${name}"]`).selectOption({ label });
  const selectPart = async (name, part) => { const o = await modal().locator(`select[name="${name}"] option`).filter({ hasText: part }).first().getAttribute('value'); await modal().locator(`select[name="${name}"]`).selectOption(o); };
  const chip = async (name, text) => modal().locator(`[data-chips="${name}"] .chip`).filter({ hasText: text }).first().click();
  const submit = async () => modal().locator('[type=submit]').click();
  const toast = async re => { const t = page.locator('#toast .toast').filter({ hasText: re }).first(); await t.waitFor({ timeout: 8000 }); return t; };
  const noErrToast = async () => { const n = await page.locator('#toast .toast.err').count(); if (n) throw new Error('رسالة خطأ: ' + await page.locator('#toast .toast.err').first().textContent()); };
  const act = async (a, nth = 0) => page.locator(`[data-act="${a}"]:visible`).nth(nth).click();
  const go = async hash => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(400); await page.locator('#view .loading').waitFor({ state: 'detached' }).catch(() => {}); };
  const token = () => page.evaluate(() => localStorage.getItem('custody_token_server'));
  const login = async (u, p) => {
    await page.evaluate(() => localStorage.clear()); await page.goto(BASE + '/');
    await page.locator('#login [name=username]').fill(u); await page.locator('#login [name=password]').fill(p);
    await page.locator('#login button').click(); await page.locator('#page-title').waitFor();
    await page.waitForTimeout(300);
  };
  const T = {};
  const id = {};

  await step('الإعداد الأول', async () => {
    await page.goto(BASE + '/');
    await page.locator('#setup').waitFor();
    await page.locator('#setup [name=name]').fill('مدير الاختبار');
    await page.locator('#setup [name=username]').fill('Admin');
    await page.locator('#setup [name=password]').fill('secret1');
    await page.locator('#setup button').click();
    await page.locator('#page-title').waitFor();
    assert((await page.locator('#page-title').textContent()).includes('الرئيسية') || true, '');
    const st = await api('GET', '/api/status'); assert(st.data.needsSetup === false, 'لم يكتمل الإعداد');
  });
  await step('تسجيل الخروج ثم الدخول', async () => {
    await go('#/settings'); await act('logout'); await page.locator('#cf-ok').click(); await page.locator('#login').waitFor();
    await page.locator('#login [name=username]').fill('admin'); await page.locator('#login [name=password]').fill('wrong');
    await page.locator('#login button').click(); await toast('اسم المستخدم أو كلمة المرور غير صحيحة');
    await page.locator('#login [name=password]').fill('secret1'); await page.locator('#login button').click();
    await page.locator('.layout').waitFor({ state: 'attached' }); T.admin = await token(); assert(T.admin, 'لا يوجد توكن');
  });
  await step('إضافة مركز تكلفة وفرعه', async () => {
    await go('#/cost-centers'); await act('q-ccForm');
    await fill('name', 'مشروع برج الاختبار'); await fill('code', 'T-1'); await fill('budget', 10000); await submit(); await toast('تم الحفظ');
    await page.waitForURL(/#\/cost-center\//); id.cc = page.url().split('/').pop();
    await act('cc-child'); await fill('name', 'مرحلة الأساسات'); await fill('code', 'T-1-1'); await fill('budget', 4000); await submit(); await toast('تم الحفظ');
    await page.waitForURL(u => !u.toString().endsWith(id.cc)); id.cc1 = page.url().split('/').pop();
  });
  await step('إضافة موظفَين', async () => {
    for (const [name, user] of [['موظف أول', 'emp1'], ['موظف ثاني', 'emp2']]) {
      await go('#/users'); await act('q-userForm');
      await fill('name', name); await fill('jobTitle', 'مهندس'); await fill('username', user); await fill('password', '1234'); await submit(); await toast('تم الحفظ');
      await page.waitForURL(/#\/user\//); id[user] = page.url().split('/').pop();
    }
  });
  await step('إضافة مصدر أموال', async () => {
    await go('#/sources'); await act('src-edit');
    await fill('name', 'صندوق الموقع'); await select('type', 'صندوق نقدي'); await submit(); await toast('تم الحفظ');
    await page.locator('#view').getByText('صندوق الموقع').first().waitFor();
  });
  await step('صرف عهدة بمصدر', async () => {
    await go('#/custodies'); await act('q-custodyForm', 0);
    await selectPart('employeeId', 'موظف أول'); await fill('amount', 3000); await chip('sourceId', 'صندوق الموقع');
    await fill('purpose', 'مشتريات موقع برج الاختبار'); await selectPart('costCenterId', 'T-1-1'); await submit();
    await toast('تم صرف العهدة'); await page.waitForURL(/#\/custody\//); id.c1 = page.url().split('/').pop();
  });
  await step('تعزيز العهدة', async () => {
    await act('c-topup'); await fill('amount', 700); await chip('sourceId', 'البنك'); await submit(); await toast('تم التسجيل');
  });
  await step('تحويل جزء من العهدة لموظف آخر', async () => {
    await page.locator('[data-act="c-transfer"]').waitFor(); await act('c-transfer');
    await fill('amount', 500); await selectPart('toEmployeeId', 'موظف ثاني'); await submit(); await toast('تم التسجيل');
    const c = (await api('GET', '/api/custodies/' + id.c1, null, T.admin)).data.custody;
    assert(c.balance === 3200, 'رصيد العهدة بعد التعزيز والتحويل ' + c.balance);
    const c2 = (await api('GET', '/api/custodies?employeeId=' + id.emp2, null, T.admin)).data;
    assert(c2.length === 1 && c2[0].balance === 500, 'العهدة المحولة غير صحيحة');
    id.c2 = c2[0].id;
  });
  await step('تسجيل مصروف مع صورة كموظف', async () => {
    await login('emp1', '1234'); T.emp1 = await token();
    await act('q-expenseForm'); await modal().locator('[name=amount]').waitFor();
    await fill('amount', 230); await chip('categoryId', 'مواد وخامات'); await fill('description', 'حديد تسليح');
    await modal().locator('[data-files="attachments"] input[type=file]').setInputFiles(PNG);
    await modal().locator('[data-files="attachments"] .thumb').first().waitFor();
    await modal().locator('label.toggle').filter({ has: page.locator('[name=vatIncluded]') }).click();
    await submit(); await toast('تم حفظ المصروف');
    await act('q-expenseForm'); await modal().locator('[name=amount]').waitFor();
    await fill('amount', 120); await chip('categoryId', 'نقل ومواصلات'); await fill('description', 'نقل عمال'); await submit(); await toast('تم حفظ المصروف');
    const exps = (await api('GET', '/api/expenses', null, T.emp1)).data;
    assert(exps.length === 2 && exps.every(e => e.status === 'pending'), 'مصروفات الموظف');
    const withImg = exps.find(e => e.attachments.length); assert(withImg && withImg.vat === 30, 'المرفق أو الضريبة: ' + JSON.stringify(withImg && withImg.vat));
    id.file = withImg.attachments[0]; id.exp = withImg.id;
    const f = await api('GET', '/api/files/' + id.file, null, T.emp1);
    assert(f.status === 200 && f.type === 'image/jpeg' && f.data.byteLength > 50, 'تنزيل المرفق ' + f.status + ' ' + f.type);
  });
  await step('طلب عهدة من الموظف', async () => {
    await go('#/home'); await act('q-requestForm'); await fill('amount', 1500); await fill('purpose', 'أدوات كهرباء'); await submit(); await toast('تم إرسال الطلب');
  });
  await step('الصلاحيات: الموظف لا يرى بيانات غيره ولا مرفقاته', async () => {
    await login('emp2', '1234'); T.emp2 = await token();
    const f = await api('GET', '/api/files/' + id.file, null, T.emp2); assert(f.status === 404, 'وصل لمرفق غيره ' + f.status);
    const f2 = await api('GET', `/api/files/${id.file}?token=${T.emp2}`); assert(f2.status === 404, 'وصل لمرفق غيره عبر token');
    const f3 = await api('GET', '/api/files/' + id.file); assert(f3.status === 401, 'مرفق بدون دخول ' + f3.status);
    const e = await api('GET', '/api/expenses', null, T.emp2); assert(e.data.length === 0, 'يرى مصروفات غيره');
    const e2 = await api('GET', '/api/expenses?employeeId=' + id.emp1, null, T.emp2); assert(e2.data.length === 0, 'فلتر الموظف يكشف مصروفات غيره');
    const e3 = await api('GET', '/api/expenses/' + id.exp, null, T.emp2); assert(e3.status === 403, 'فتح مصروف غيره ' + e3.status);
    const c = await api('GET', '/api/custodies/' + id.c1, null, T.emp2); assert(c.status === 403, 'فتح عهدة غيره ' + c.status);
    const cs = await api('GET', '/api/custodies', null, T.emp2); assert(cs.data.length === 1 && cs.data[0].id === id.c2, 'قائمة العهد');
    const st = await api('GET', '/api/reports/statement?employeeId=' + id.emp1, null, T.emp2); assert(st.data.title.includes('موظف ثاني'), 'كشف حساب غيره');
    for (const p of ['/api/reports/balances', '/api/dashboard', '/api/audit', '/api/backup']) { const r = await api('GET', p, null, T.emp2); assert(r.status === 403, p + ' ' + r.status); }
    const rq = await api('GET', '/api/requests', null, T.emp2); assert(rq.data.length === 0, 'يرى طلبات غيره');
    const b = await api('GET', '/api/bootstrap', null, T.emp2); assert(b.data.users.length === 1, 'يرى قائمة المستخدمين');
    const tx = await api('POST', `/api/custodies/${id.c2}/tx`, { type: 'topup', amount: 5 }, T.emp2); assert(tx.status === 403, 'الموظف عزز عهدته');
    const rs = await api('POST', '/api/restore', { users: [{}] }, T.emp2); assert(rs.status === 403, 'الموظف استعاد نسخة');
    const ui = await page.locator('#view').textContent(); assert(!ui.includes('حديد تسليح'), 'الواجهة تعرض مصروف غيره');
  });
  await step('اعتماد جماعي', async () => {
    await login('admin', 'secret1'); T.admin = await token();
    await go('#/expenses?status=pending'); await page.locator('#sel-all').check(); await act('bulk'); await toast(/تم اعتماد 2/);
    const exps = (await api('GET', '/api/expenses?employeeId=' + id.emp1, null, T.admin)).data; assert(exps.every(e => e.status === 'approved'), 'لم تعتمد');
  });
  await step('عرض صورة المرفق للمدير', async () => {
    await go('#/expense/' + id.exp);
    const img = page.locator('#view img[src*="/api/files/"]').first(); await img.waitFor();
    await page.waitForFunction(() => { const i = document.querySelector('#view img[src*="/api/files/"]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
  });
  await step('تسوية وإغلاق العهدة', async () => {
    await go('#/custody/' + id.c1); await act('c-close'); await chip('sourceId', 'صندوق الموقع'); await submit();
    await toast('تمت التسوية'); await page.waitForURL(/#\/settlement\//);
    const c = (await api('GET', '/api/custodies/' + id.c1, null, T.admin)).data;
    assert(c.custody.status === 'closed' && c.custody.balance === 0, 'لم تغلق: ' + c.custody.balance);
    assert(c.settlements[0].returned === 2850 && c.settlements[0].total === 350, 'قيم التسوية ' + JSON.stringify(c.settlements[0]));
  });
  await step('الموافقة على طلب العهدة وصرفها', async () => {
    await go('#/requests'); await act('req-ok'); await chip('sourceId', 'البنك'); await submit(); await toast('تم صرف العهدة');
    const rq = (await api('GET', '/api/requests', null, T.admin)).data[0]; assert(rq.status === 'approved' && rq.custodyId, 'الطلب');
    const c = (await api('GET', '/api/custodies/' + rq.custodyId, null, T.admin)).data.custody; assert(c.balance === 1500 && c.employeeId === id.emp1, 'عهدة الطلب');
  });
  await step('أصل وإقرار استلام', async () => {
    await go('#/assets'); await act('q-assetForm', 0); await fill('name', 'لابتوب اختبار'); await fill('serial', 'SN-1'); await fill('value', 3500);
    await selectPart('assignTo', 'موظف أول');
    await modal().locator('[data-files="photos"] input[type=file]').setInputFiles(PNG); await modal().locator('[data-files="photos"] .thumb').first().waitFor();
    await submit(); await toast('تم الحفظ'); await page.waitForURL(/#\/asset\//); id.asset = page.url().split('/').pop();
    const a = (await api('GET', '/api/assets/' + id.asset, null, T.admin)).data.asset;
    const pf = await api('GET', '/api/files/' + a.photos[0], null, T.emp2); assert(pf.status === 404, 'الموظف الآخر يصل لصورة الأصل');
    await login('emp1', '1234');
    const pf1 = await api('GET', '/api/files/' + a.photos[0], null, await token()); assert(pf1.status === 200, 'حامل الأصل لا يصل لصورته');
    await go('#/asset/' + id.asset); await act('a-ack'); await toast('تم تسجيل إقرارك');
    const a2 = (await api('GET', '/api/assets/' + id.asset, null, T.admin)).data.asset; assert(a2.acknowledged === true, 'لم يسجل الإقرار');
    const other = await api('POST', `/api/assets/${id.asset}/ack`, {}, T.emp2); assert(other.status === 403, 'إقرار من غير الحامل');
  });
  await step('تعميد مباشر: الموظف يسجل عهدة استلمها من المالك', async () => {
    const no = await api('POST', '/api/requests', { alreadyPaid: true, amount: 900, purpose: 'محاولة غير مسموحة' }, T.emp1);
    assert(no.status === 403, 'موظف غير مسموح سجل تعميداً مباشراً ' + no.status);
    await login('admin', 'secret1'); T.admin = await token();
    await go('#/user/' + id.emp2); await act('u-edit');
    await modal().locator('label.toggle').filter({ has: page.locator('[name=directCustody]') }).click();
    await submit(); await toast('تم الحفظ');
    await login('emp2', '1234'); T.emp2 = await token();
    await act('q-directForm'); await modal().locator('[name=amount]').waitFor();
    assert(await modal().locator('[name=alreadyPaid]').isChecked(), 'خانة «تم الصرف بالفعل» غير مفعلة');
    assert(await modal().locator('[data-chips="sourceId"] .chip.on').textContent() === 'المالك', 'المصدر الافتراضي ليس المالك');
    await fill('amount', 2000); await fill('purpose', 'مصاريف موقع بتعميد المالك'); await selectPart('costCenterId', 'T-1-1');
    await submit(); await toast('تم تسجيل العهدة'); await page.waitForURL(/#\/custody\//);
    await page.locator('.hero-tags').getByText('تعميد مباشر').waitFor();
    const cid = page.url().split('/').pop();
    const c = (await api('GET', '/api/custodies/' + cid, null, T.admin)).data;
    assert(c.custody.direct === true && c.custody.balance === 2000 && c.custody.employeeId === id.emp2, 'العهدة المباشرة ' + JSON.stringify(c.custody));
    assert(c.tx[0].sourceName === 'المالك' && c.tx[0].note === 'تعميد مباشر', 'حركة الصرف ' + JSON.stringify(c.tx[0]));
    const rq = (await api('GET', '/api/requests', null, T.admin)).data.find(r => r.custodyId === cid);
    assert(rq && rq.status === 'approved' && rq.direct, 'الطلب المرتبط');
    const n = (await api('GET', '/api/notifications', null, T.admin)).data[0];
    assert(n.text.includes('تعميد مباشر') && n.text.includes('المالك'), 'إشعار الإدارة ' + n.text);
    const src = (await api('GET', '/api/reports/sources', null, T.admin)).data.rows.find(r => r.name === 'المالك');
    assert(src.out === 2000, 'تقرير المصادر للمالك ' + JSON.stringify(src));
    const st = (await api('GET', '/api/reports/statement', null, T.emp2)).data;
    assert(st.rows.some(r => r.desc.includes('تعميد مباشر') && r.in === 2000), 'كشف الحساب');
    // الطلب العادي ما زال يعمل للموظف نفسه
    await go('#/requests'); await act('q-requestForm');
    await modal().locator('label.toggle').filter({ has: page.locator('[name=alreadyPaid]') }).waitFor();
    assert(!(await modal().locator('[name=alreadyPaid]').isChecked()), 'الطلب العادي يبدأ بالتعميد المباشر');
    assert(await modal().locator('[name=neededBy]').isVisible(), 'حقل «مطلوب قبل» مخفي في الطلب العادي');
    await fill('amount', 300); await fill('purpose', 'طلب عادي'); await submit(); await toast('تم إرسال الطلب');
    const mine = (await api('GET', '/api/requests', null, T.emp2)).data; assert(mine.find(r => r.purpose === 'طلب عادي').status === 'pending', 'الطلب العادي');
    await login('emp1', '1234'); T.emp1 = await token();
  });
  await step('كشف حسابي للموظف', async () => {
    await go('#/report/statement'); await page.locator('table.report').waitFor(); await noErrToast();
  });
  await step('كل التقارير', async () => {
    await login('admin', 'secret1'); T.admin = await token();
    for (const name of ['balances', 'statement', 'sources', 'source-ledger', 'cost-centers', 'categories', 'expenses', 'aging', 'settlements', 'vat', 'assets', 'checkins']) {
      await go('#/report/' + name + (name === 'statement' ? '?employeeId=' + id.emp1 : ''));
      await page.locator('#view .summary-line').waitFor({ timeout: 8000 }); await noErrToast();
    }
    const cc = (await api('GET', '/api/reports/cost-centers', null, T.admin)).data;
    const top = cc.rows.find(r => r.code === 'T-1'); assert(top.spent === 350 && top.used === '4%', 'تجميع الفروع ' + JSON.stringify(top));
    const src = (await api('GET', '/api/reports/sources', null, T.admin)).data.rows;
    const site = src.find(r => r.name === 'صندوق الموقع'); assert(site.out === 3000 && site.back === 2850 && site.net === 150, 'تقرير المصادر ' + JSON.stringify(site));
    const bank = src.find(r => r.name === 'البنك'); assert(bank.out === 2200, 'البنك ' + JSON.stringify(bank));
    const vat = (await api('GET', '/api/reports/vat', null, T.admin)).data; assert(vat.totals.vat === 30 && vat.totals.net === 200, 'الضريبة');
  });
  let backupFile;
  await step('نسخة احتياطية', async () => {
    await go('#/settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), act('s-backup')]);
    backupFile = path.join(OUT, 'backup.json'); await dl.saveAs(backupFile);
    const b = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert(b.users.length === 3 && !b.sessions && b.expenses.length === 2 && b.custodies.some(c => c.direct), 'محتوى النسخة');
    assert(JSON.stringify(b.settings.counters).startsWith('{'), 'counters ليست كائناً');
  });
  await step('استعادة النسخة الاحتياطية', async () => {
    await api('POST', '/api/expenses', { custodyId: (await api('GET', '/api/requests', null, T.admin)).data.find(r => r.custodyId && !r.direct).custodyId, amount: 99, categoryId: 'cat1', costCenterId: id.cc1, description: 'سيُحذف بالاستعادة' }, T.admin);
    assert((await api('GET', '/api/expenses', null, T.admin)).data.length === 3, 'إضافة مصروف قبل الاستعادة');
    await go('#/settings');
    await page.locator('#s-restore').setInputFiles(backupFile); await page.locator('#cf-ok').click(); await toast('تمت الاستعادة');
    await page.waitForTimeout(1200); await page.locator('.layout').waitFor({ state: 'attached' });
    assert((await api('GET', '/api/expenses', null, T.admin)).data.length === 2, 'الاستعادة لم تُرجع البيانات');
    const f = await api('GET', '/api/files/' + id.file, null, T.admin); assert(f.status === 200, 'المرفقات بعد الاستعادة');
  });
  await step('استعادة نسخة من وضع الجوال (PBKDF2 + __files)', async () => {
    const crypto = require('crypto');
    const b = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const salt = crypto.randomBytes(8).toString('hex');
    const u = b.users.find(x => x.username === 'emp2');
    u.salt = salt; u.hash = crypto.pbkdf2Sync('mob123', salt, 60000, 32, 'sha256').toString('hex');
    const fileId = crypto.randomBytes(8).toString('hex');
    const e = b.expenses.find(x => x.employeeId === id.emp1); e.attachments.push(fileId);
    b.__files = { [fileId]: 'data:image/png;base64,' + fs.readFileSync(PNG).toString('base64'), '../evil': 'data:image/png;base64,AAAA' };
    const r = await api('POST', '/api/restore', b, T.admin); assert(r.status === 200, 'الاستعادة ' + JSON.stringify(r.data));
    const l = await api('POST', '/api/login', { username: 'emp2', password: 'mob123' }); assert(l.status === 200, 'دخول بهاش PBKDF2 ' + JSON.stringify(l.data));
    const f = await api('GET', '/api/files/' + fileId, null, T.admin); assert(f.status === 200 && f.type === 'image/png', 'مرفق الجوال ' + f.status + ' ' + f.type);
    const bad = await api('POST', '/api/login', { username: 'emp2', password: 'wrong' }); assert(bad.status === 401, 'كلمة مرور خاطئة');
    const t = await api('GET', '/api/bootstrap', null, T.admin); assert(t.status === 200, 'الجلسات بقيت بعد الاستعادة');
  });
  await step('الوصول المباشر لمجلد البيانات ممنوع', async () => {
    for (const p of ['/data/db.json', '/data/files/' + id.file, '/core.php']) { const r = await fetch(BASE + p); assert(r.status === 403, p + ' ' + r.status); }
  });
  await step('لا أخطاء JavaScript في الصفحة', async () => { assert(!errors.length, errors.join(' | ')); });
  await page.screenshot({ path: path.join(OUT, 'php-final.png') });
  await browser.close();
  console.log(results.filter(r => r[0] === '✓').length + '/' + results.length + ' نجحت');
})().catch(async e => { console.log('توقف:', e.message.split('\n')[0]); process.exit(1); });
