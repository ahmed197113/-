// اختبار التسجيل السريع للعامل على خادم PHP فارغ
const { chromium } = require('playwright');
const base = process.argv[2], SP = process.argv[3];
(async () => {
  const j = async (m, u, b, t) => (await fetch(base + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
  await j('POST', '/api/setup', { name: 'المدير', username: 'admin', password: 'admin1', companyName: 'شركة' });
  const at = (await j('POST', '/api/login', { username: 'admin', password: 'admin1' })).token;
  await j('POST', '/api/cost-centers', { name: 'المصنع', code: '1' }, at);
  await j('POST', '/api/cost-centers', { name: 'المسغله', code: '2' }, at);
  await j('POST', '/api/users', { name: 'عبدو شماع', username: 'abdo', password: '1234', role: 'employee', directCustody: true }, at);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
  const modal = () => page.locator('.modal-back').last();
  await page.goto(base);
  await page.locator('#login [name=username]').fill('abdo'); await page.locator('#login [name=password]').fill('1234'); await page.locator('#login button').click();
  await page.waitForSelector('#q-line');
  await page.screenshot({ path: SP + '/q-home.png', fullPage: true });
  const et = await page.evaluate(() => localStorage.getItem('custody_token_server'));
  const home = async () => j('GET', '/api/home', null, et);

  // 1) استلمت 500 بسطر واحد
  await page.fill('#q-line input', 'استلمت ٥٠٠');
  ok((await page.locator('#q-hint').innerText()).includes('500'), 'التلميح يعرض استلام 500: ' + await page.locator('#q-hint').innerText());
  await page.click('#q-line button');
  await page.waitForSelector('.modal-back');
  ok(await modal().locator('[name=amount]').inputValue() === '500', 'نموذج الاستلام فيه المبلغ جاهزاً');
  await modal().locator('.chip', { hasText: 'المسغله' }).click();
  await page.screenshot({ path: SP + '/q-receive.png' });
  await modal().locator('button[type=submit]').click(); await page.waitForTimeout(800);
  ok((await home()).totals.balance === 500, 'عهدة 500 مسجلة');

  // 2) سطر واحد: اكل 300
  await page.fill('#q-line input', 'اكل 30');
  ok((await page.locator('#q-hint').innerText()).includes('إعاشة'), 'التلميح يعرف البند: ' + await page.locator('#q-hint').innerText());
  await page.click('#q-line button'); await page.waitForTimeout(900);
  let h = await home();
  ok(h.recent[0] && h.recent[0].amount === 30 && h.recent[0].description === 'اكل', 'مصروف «اكل 30» محفوظ بلا أي سؤال');
  await page.fill('#q-line input', 'بنزين 50 ريال'); await page.click('#q-line button'); await page.waitForTimeout(900);
  await page.fill('#q-line input', 'حاجات للموقع 20'); await page.click('#q-line button'); await page.waitForTimeout(900);
  const ex = await j('GET', '/api/expenses', null, at);
  ok(ex.find(e => e.amount === 50).categoryName.includes('وقود'), 'بنزين ← وقود ومحروقات');
  ok(ex.find(e => e.amount === 20).categoryName.includes('متنوعة'), 'نص غير معروف ← مصروفات متنوعة');
  ok(ex.every(e => e.costCenterName.includes('المسغله')), 'المشروع يُؤخذ من العهدة تلقائياً');

  // 3) بلاطة بند
  await page.locator('.q-tile', { hasText: 'نقل' }).click();
  await modal().locator('[name=amount]').fill('15');
  await modal().locator('button[type=submit]').click(); await page.waitForTimeout(900);
  ok((await j('GET', '/api/expenses', null, at)).some(e => e.amount === 15 && e.categoryName.includes('نقل')), 'زر «نقل» + المبلغ = مصروف');

  // 4) صورة + مبلغ
  await page.click('[data-act="q-photo"]');
  await modal().locator('input[type=file]').setInputFiles(SP + '/t3/r.png');
  await page.waitForTimeout(400);
  await modal().locator('[name=amount]').fill('40');
  await page.screenshot({ path: SP + '/q-photo.png' });
  await modal().locator('button[type=submit]').click(); await page.waitForTimeout(900);
  const ph = (await j('GET', '/api/expenses', null, at)).find(e => e.amount === 40);
  ok(ph && ph.attachments.length === 1, 'صورة + 40 محفوظة بمرفق');

  h = await home();
  ok(h.totals.balance === 500 - 30 - 50 - 20 - 15 - 40, 'الرصيد صحيح: ' + h.totals.balance);
  // 5) صرف أكثر من العهدة: يدفع من جيبه، والعجز يُغطّى من العهدة القادمة
  await page.fill('#q-line input', 'اسمنت 400'); await page.click('#q-line button'); await page.waitForTimeout(900);
  h = await home();
  ok(h.totals.balance === -55, 'الصرف أكثر من العهدة مسموح والرصيد بالسالب: ' + h.totals.balance);
  ok((await page.locator('.s-bal').innerText()).includes('من جيبك'), 'الشاشة تقول: دفعت من جيبك');
  await page.click('[data-act="q-receive"]'); await modal().locator('[name=amount]').fill('500');
  await modal().locator('.chip', { hasText: 'المصنع' }).click();
  await modal().locator('button[type=submit]').click(); await page.waitForTimeout(1200);
  const cs = await j('GET', '/api/custodies?status=open', null, at);
  const neu = cs.find(c => c.coveredDeficit), old = cs.find(c => !c.coveredDeficit);
  ok(neu && neu.coveredDeficit === 55 && neu.balance === 445 && old.balance === 0, `العهدة الجديدة 500 غطّت العجز 55 فبقي 445 (القديمة ${old && old.balance})`);
  ok((await home()).totals.balance === 445, 'الرصيد الإجمالي 445');
  await page.reload(); await page.waitForSelector('#q-line');
  await page.screenshot({ path: SP + '/q-home-after.png', fullPage: true });
  ok(errors.length === 0, 'لا أخطاء JavaScript ' + errors.join(' | '));
  await browser.close();
})();
