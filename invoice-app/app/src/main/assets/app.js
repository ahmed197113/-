var VAT_RATE = 0.15;
var KEY = 'baqala-invoice-v1';

var db = load();
var cart = [];
var currentView = null;
var navStack = ['new'];

var TITLES = { new: 'فاتورة جديدة', list: 'الفواتير', items: 'الأصناف', settings: 'الإعدادات', view: 'الفاتورة' };

function load() {
  try {
    var d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.invoices) return d;
  } catch (e) {}
  return {
    settings: { name: '', cr: '', address: '', phone: '', vat: false, vatNo: '', incl: true, footer: 'شكراً لزيارتكم' },
    items: [],
    invoices: [],
    seq: 0
  };
}
function persist() { localStorage.setItem(KEY, JSON.stringify(db)); }

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function money(n) { return r2(n).toFixed(2); }
function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2500);
}

// ---------- navigation ----------
function show(page, fromBack) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.add('hidden'); });
  $('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.page === page);
  });
  $('title').textContent = TITLES[page];
  if (!fromBack && navStack[navStack.length - 1] !== page) navStack.push(page);
  if (page === 'new') renderNew();
  if (page === 'list') renderList();
  if (page === 'items') renderItems();
  if (page === 'settings') renderSettings();
  window.scrollTo(0, 0);
}
function goBack() {
  if (navStack.length <= 1) return false;
  navStack.pop();
  show(navStack[navStack.length - 1], true);
  return true;
}

// ---------- settings ----------
function renderSettings() {
  var s = db.settings;
  $('s-name').value = s.name;
  $('s-cr').value = s.cr;
  $('s-address').value = s.address;
  $('s-phone').value = s.phone;
  $('s-vat').checked = s.vat;
  $('s-vatno').value = s.vatNo;
  $('s-incl').checked = s.incl;
  $('s-footer').value = s.footer;
  toggleVatFields();
}
function toggleVatFields() {
  var on = $('s-vat').checked;
  $('vat-fields').classList.toggle('hidden', !on);
  $('novat-note').classList.toggle('hidden', on);
}
function saveSettings() {
  var s = {
    name: $('s-name').value.trim(),
    cr: $('s-cr').value.trim(),
    address: $('s-address').value.trim(),
    phone: $('s-phone').value.trim(),
    vat: $('s-vat').checked,
    vatNo: $('s-vatno').value.trim(),
    incl: $('s-incl').checked,
    footer: $('s-footer').value.trim()
  };
  if (!s.name) return toast('اسم المحل مطلوب');
  if (s.vat && !isValidVatNumber(s.vatNo)) return toast('الرقم الضريبي غير صحيح: 15 رقماً يبدأ وينتهي بـ 3');
  if (!s.vat) s.vatNo = '';
  db.settings = s;
  persist();
  toast('تم الحفظ');
}

// ---------- items ----------
function addItem() {
  var name = $('item-name').value.trim();
  var price = parseFloat($('item-price').value);
  if (!name || !(price >= 0)) return toast('أدخل الاسم والسعر');
  db.items.push({ id: Date.now(), name: name, price: price });
  persist();
  $('item-name').value = '';
  $('item-price').value = '';
  renderItems();
}
function deleteItem(id) {
  db.items = db.items.filter(function (i) { return i.id !== id; });
  persist();
  renderItems();
}
function renderItems() {
  $('item-list').innerHTML = db.items.map(function (i) {
    return '<div class="list-row"><span>' + esc(i.name) + '</span><b>' + money(i.price) +
      '</b><button class="x" onclick="deleteItem(' + i.id + ')">✕</button></div>';
  }).join('') || '<div class="muted small center">لا توجد أصناف محفوظة.</div>';
}

// ---------- cart ----------
function renderNew() {
  $('setup-warning').classList.toggle('hidden', !!db.settings.name);
  $('quick-items').innerHTML = db.items.map(function (i) {
    return '<button class="chip" onclick="addQuick(' + i.id + ')">' + esc(i.name) + ' <small>' + money(i.price) + '</small></button>';
  }).join('');
  $('no-quick').classList.toggle('hidden', db.items.length > 0);
  renderCart();
}
function addQuick(id) {
  var item = db.items.filter(function (i) { return i.id === id; })[0];
  var existing = cart.filter(function (l) { return l.name === item.name && l.price === item.price; })[0];
  if (existing) existing.qty += 1;
  else cart.push({ name: item.name, qty: 1, price: item.price });
  renderCart();
}
function addManualLine() {
  var name = $('line-name').value.trim();
  var qty = parseFloat($('line-qty').value);
  var price = parseFloat($('line-price').value);
  if (!name || !(qty > 0) || !(price >= 0)) return toast('أدخل الاسم والكمية والسعر');
  cart.push({ name: name, qty: qty, price: price });
  $('line-name').value = '';
  $('line-qty').value = '1';
  $('line-price').value = '';
  renderCart();
}
function changeQty(i, d) {
  cart[i].qty = r2(cart[i].qty + d);
  if (cart[i].qty <= 0) cart.splice(i, 1);
  renderCart();
}
function clearCart() { cart = []; renderCart(); }

// Totals for the given lines under the current VAT settings.
function computeTotals(lines, s) {
  var gross = lines.reduce(function (a, l) { return a + l.qty * l.price; }, 0);
  if (!s.vat) return { net: r2(gross), vat: 0, total: r2(gross) };
  if (s.incl) {
    var total = r2(gross);
    var vat = r2(total * VAT_RATE / (1 + VAT_RATE));
    return { net: r2(total - vat), vat: vat, total: total };
  }
  var net = r2(gross);
  var v = r2(net * VAT_RATE);
  return { net: net, vat: v, total: r2(net + v) };
}
function totalsHtml(t, s) {
  if (!s.vat) return '<div class="t-row grand"><span>الإجمالي</span><b>' + money(t.total) + ' ر.س</b></div>';
  return '<div class="t-row"><span>الإجمالي غير شامل الضريبة</span><b>' + money(t.net) + '</b></div>' +
    '<div class="t-row"><span>ضريبة القيمة المضافة 15%</span><b>' + money(t.vat) + '</b></div>' +
    '<div class="t-row grand"><span>الإجمالي شامل الضريبة</span><b>' + money(t.total) + ' ر.س</b></div>';
}
function renderCart() {
  $('cart').innerHTML = cart.map(function (l, i) {
    return '<tr><td>' + esc(l.name) + '</td>' +
      '<td class="qty"><button onclick="changeQty(' + i + ',-1)">−</button>' + l.qty + '<button onclick="changeQty(' + i + ',1)">+</button></td>' +
      '<td>' + money(l.price) + '</td><td>' + money(l.qty * l.price) + '</td>' +
      '<td><button class="x" onclick="cart.splice(' + i + ',1);renderCart()">✕</button></td></tr>';
  }).join('');
  $('cart-empty').classList.toggle('hidden', cart.length > 0);
  $('cart-totals').innerHTML = cart.length ? totalsHtml(computeTotals(cart, db.settings), db.settings) : '';
}

// ---------- invoices ----------
function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

function buildDoc(type, lines, extra) {
  var s = db.settings;
  db.seq += 1;
  var prefix = type === 'credit' ? 'CN-' : 'INV-';
  var doc = {
    id: Date.now(),
    no: prefix + String(db.seq).padStart(6, '0'),
    type: type,
    date: nowIso(),
    seller: { name: s.name, cr: s.cr, address: s.address, phone: s.phone, vat: s.vat, vatNo: s.vatNo, incl: s.incl, footer: s.footer },
    lines: lines,
    customer: extra.customer || '',
    pay: extra.pay || '',
    ref: extra.ref || ''
  };
  doc.totals = computeTotals(lines, doc.seller);
  if (doc.seller.vat) {
    doc.qr = zatcaTlvBase64(s.name, s.vatNo, doc.date, money(doc.totals.total), money(doc.totals.vat));
  }
  return doc;
}

function saveInvoice() {
  if (!db.settings.name) { show('settings'); return toast('أكمل بيانات المحل أولاً'); }
  if (!cart.length) return toast('أضف صنفاً واحداً على الأقل');
  var doc = buildDoc('invoice', cart.slice(), { customer: $('customer-name').value.trim(), pay: $('pay-method').value });
  db.invoices.unshift(doc);
  persist();
  cart = [];
  $('customer-name').value = '';
  openInvoice(doc.id);
}

function createCreditNote(id) {
  var inv = findDoc(id);
  if (hasCreditNote(inv.no)) return toast('يوجد إشعار دائن لهذه الفاتورة');
  if (!confirm('إصدار إشعار دائن (مرتجع كامل) للفاتورة ' + inv.no + '؟')) return;
  // Use the original invoice's VAT settings so the reversal matches it exactly.
  var current = db.settings;
  db.settings = Object.assign({}, current, { vat: inv.seller.vat, vatNo: inv.seller.vatNo, incl: inv.seller.incl });
  var doc = buildDoc('credit', inv.lines.slice(), { customer: inv.customer, ref: inv.no, pay: inv.pay });
  db.settings = current;
  db.invoices.unshift(doc);
  persist();
  openInvoice(doc.id);
}
function hasCreditNote(no) {
  return db.invoices.some(function (d) { return d.type === 'credit' && d.ref === no; });
}
function findDoc(id) { return db.invoices.filter(function (d) { return d.id === id; })[0]; }

function docTitle(d) {
  if (d.type === 'credit') return d.seller.vat ? 'إشعار دائن لفاتورة ضريبية مبسطة' : 'إشعار مرتجع';
  return d.seller.vat ? 'فاتورة ضريبية مبسطة' : 'فاتورة مبيعات';
}
function localDate(iso) {
  var d = new Date(iso);
  function p(n) { return String(n).padStart(2, '0'); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function openInvoice(id) {
  var d = findDoc(id);
  currentView = d;
  var s = d.seller;
  var html = '<div class="r-head"><div class="r-store">' + esc(s.name) + '</div>' +
    (s.address ? '<div>' + esc(s.address) + '</div>' : '') +
    (s.phone ? '<div>جوال: ' + esc(s.phone) + '</div>' : '') +
    (s.cr ? '<div>س.ت: ' + esc(s.cr) + '</div>' : '') +
    (s.vat ? '<div>الرقم الضريبي: ' + esc(s.vatNo) + '</div>' : '') +
    '</div><div class="r-title">' + docTitle(d) + '</div>' +
    '<div class="r-meta"><div>رقم: ' + d.no + '</div><div>التاريخ: <bdi dir="ltr">' + localDate(d.date) + '</bdi></div>' +
    (d.ref ? '<div>مرجع الفاتورة: ' + esc(d.ref) + '</div>' : '') +
    (d.customer ? '<div>العميل: ' + esc(d.customer) + '</div>' : '') +
    (d.pay ? '<div>الدفع: ' + esc(d.pay) + '</div>' : '') + '</div>' +
    '<table class="r-lines"><thead><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>مجموع</th></tr></thead><tbody>' +
    d.lines.map(function (l) {
      return '<tr><td>' + esc(l.name) + '</td><td>' + l.qty + '</td><td>' + money(l.price) + '</td><td>' + money(l.qty * l.price) + '</td></tr>';
    }).join('') + '</tbody></table>' +
    (s.vat ? '<div class="small center">' + (s.incl ? 'الأسعار شاملة ضريبة القيمة المضافة' : 'الأسعار غير شاملة الضريبة') + '</div>' : '') +
    '<div class="totals">' + totalsHtml(d.totals, s) + '</div>';
  if (d.qr) html += '<div class="r-qr">' + qrSvg(d.qr, 4) + '</div>';
  if (s.footer) html += '<div class="r-foot">' + esc(s.footer) + '</div>';
  $('receipt').innerHTML = html;

  var extra = '';
  if (d.qr) {
    var f = zatcaTlvDecode(d.qr);
    var ok = f[1] === s.name && f[2] === s.vatNo && f[4] === money(d.totals.total) && f[5] === money(d.totals.vat);
    extra += '<div class="card small"><b>' + (ok ? '✔ رمز QR سليم' : '✖ خطأ في رمز QR') + '</b><br>' +
      'البائع: ' + esc(f[1]) + '<br>الرقم الضريبي: ' + esc(f[2]) + '<br>الوقت: ' + esc(f[3]) +
      '<br>الإجمالي: ' + esc(f[4]) + '<br>الضريبة: ' + esc(f[5]) + '</div>';
  }
  if (d.type === 'invoice' && !hasCreditNote(d.no)) {
    extra += '<button class="btn danger" onclick="createCreditNote(' + d.id + ')">إصدار إشعار دائن (مرتجع)</button>';
  }
  $('view-extra').innerHTML = extra;
  show('view');
}

function printInvoice() {
  var name = currentView ? currentView.no : 'invoice';
  if (window.Android && Android.print) Android.print(name);
  else window.print();
}

function renderList() {
  var q = ($('search').value || '').trim();
  var today = localDate(new Date().toISOString()).slice(0, 10);
  var sum = { count: 0, total: 0, vat: 0 };
  db.invoices.forEach(function (d) {
    if (localDate(d.date).slice(0, 10) !== today) return;
    var sign = d.type === 'credit' ? -1 : 1;
    if (d.type === 'invoice') sum.count++;
    sum.total += sign * d.totals.total;
    sum.vat += sign * d.totals.vat;
  });
  $('stats').innerHTML = '<div><small>فواتير اليوم</small><b>' + sum.count + '</b></div>' +
    '<div><small>مبيعات اليوم</small><b>' + money(sum.total) + '</b></div>' +
    '<div><small>ضريبة اليوم</small><b>' + money(sum.vat) + '</b></div>';
  var list = db.invoices.filter(function (d) {
    return !q || d.no.indexOf(q) >= 0 || (d.customer || '').indexOf(q) >= 0;
  });
  $('invoice-list').innerHTML = list.map(function (d) {
    return '<div class="list-row click' + (d.type === 'credit' ? ' credit' : '') + '" onclick="openInvoice(' + d.id + ')">' +
      '<span><b>' + d.no + '</b><br><small><bdi dir="ltr">' + localDate(d.date) + '</bdi>' + (d.customer ? ' · ' + esc(d.customer) : '') + '</small></span>' +
      '<b>' + (d.type === 'credit' ? '−' : '') + money(d.totals.total) + '</b></div>';
  }).join('') || '<div class="muted small center">لا توجد فواتير.</div>';
}

// ---------- backup ----------
function exportBackup() {
  $('backup').value = JSON.stringify(db);
  $('backup').select();
  toast('انسخ النص واحفظه في مكان آمن');
}
function importBackup() {
  try {
    var d = JSON.parse($('backup').value);
    if (!d || !Array.isArray(d.invoices) || !d.settings) throw 0;
    if (!confirm('سيتم استبدال البيانات الحالية بالنسخة الاحتياطية. متابعة؟')) return;
    db = d;
    persist();
    renderSettings();
    toast('تم الاسترجاع');
  } catch (e) {
    toast('نص النسخة الاحتياطية غير صالح');
  }
}

show('new');
