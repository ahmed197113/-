<?php
// منطق نظام إدارة العهد — نقل حرفي لـ public/core.js إلى PHP (نفس المسارات والحقول والرسائل والحسابات)
// البيانات كائنات stdClass حتى تبقى التعديلات بالمرجع كما في JavaScript
namespace Custody;

const ROLES = ['admin' => 'مدير النظام', 'owner' => 'المالك', 'accountant' => 'محاسب', 'employee' => 'موظف'];
const KINDS = ['permanent' => 'عهدة مستديمة', 'temporary' => 'عهدة مؤقتة'];
const CUSTODY_STATUS = ['open' => 'مفتوحة', 'closed' => 'مغلقة'];
const EXPENSE_STATUS = ['pending' => 'بانتظار الاعتماد', 'approved' => 'معتمد', 'rejected' => 'مرفوض'];
const TX_TYPES = [
  'issue' => ['label' => 'صرف عهدة', 'sign' => 1], 'topup' => ['label' => 'تعزيز العهدة', 'sign' => 1], 'transfer_in' => ['label' => 'تحويل وارد', 'sign' => 1],
  'reimburse' => ['label' => 'صرف فرق للموظف', 'sign' => 1], 'return' => ['label' => 'رد نقدي من الموظف', 'sign' => -1], 'transfer_out' => ['label' => 'تحويل صادر', 'sign' => -1],
];
const ASSET_STATUS = ['available' => 'متاح بالمستودع', 'assigned' => 'مسلَّم لموظف', 'maintenance' => 'في الصيانة', 'lost' => 'مفقود / تالف', 'retired' => 'مستبعد'];
const ASSET_MOVES = ['assign' => 'تسليم لموظف', 'return' => 'استلام من الموظف', 'transfer' => 'نقل لموظف آخر', 'maintenance' => 'إرسال للصيانة', 'available' => 'إرجاع للمستودع', 'lost' => 'تسجيل فقد / تلف', 'retire' => 'استبعاد'];
const CC_TYPES = ['project' => 'مشروع', 'department' => 'إدارة / قسم', 'branch' => 'فرع', 'vehicle' => 'مركبة / معدة', 'other' => 'أخرى'];
// مصادر الأموال: من أين تُصرف العهدة وإلى أين تُرد
const SOURCE_TYPES = ['cash' => 'صندوق نقدي', 'bank' => 'حساب بنكي', 'owner' => 'المالك', 'partner' => 'شريك', 'client' => 'عميل / مالك مشروع', 'other' => 'أخرى'];
const DEFAULT_SOURCES = [['الصندوق الرئيسي', 'cash'], ['البنك', 'bank'], ['المالك', 'owner']];
const ASSET_CATEGORIES = ['أجهزة حاسب', 'جوالات وأجهزة اتصال', 'معدات وعدد', 'مركبات', 'أثاث', 'أخرى'];
const DEFAULT_CATEGORIES = [
  ['5101', 'مواد وخامات'], ['5102', 'نقل ومواصلات'], ['5103', 'وقود ومحروقات'], ['5104', 'إعاشة وضيافة'], ['5105', 'عمالة يومية'],
  ['5106', 'أدوات ومعدات صغيرة'], ['5107', 'صيانة وإصلاح'], ['5108', 'رسوم حكومية'], ['5109', 'قرطاسية ومطبوعات'],
  ['5110', 'اتصالات وإنترنت'], ['5111', 'سكن وإقامة'], ['5112', 'سفر وانتقالات'], ['5199', 'مصروفات متنوعة'],
];
const DEFAULT_SETTINGS = [
  'companyName' => 'شركة الخطوط المعدنية للمقاولات العامة', 'vatNumber' => '', 'address' => '', 'currency' => 'ر.س', 'vatRate' => 15,
  'workStart' => '08:00', 'workEnd' => '17:00', 'workDays' => [0, 1, 2, 3, 4], 'reminderMinutes' => 30, 'remindersEnabled' => true,
  'agingDays' => 30, 'lowBalance' => 200, 'receiptRequiredAbove' => 0,
];
const COLLECTIONS = ['users', 'fundSources', 'costCenters', 'categories', 'custodies', 'tx', 'expenses', 'settlements', 'assets', 'assetMoves', 'requests', 'checkins', 'notifications', 'audit'];

class ApiError extends \Exception {
  public $status;
  public function __construct($status, $message) { parent::__construct($message); $this->status = $status; }
}
function fail($status, $msg) { throw new ApiError($status, $msg); }

// ---------- مكافئات سلوك JavaScript ----------
/** Number(v) */
function jsnum($v) {
  if ($v === null) return 0.0;
  if (is_bool($v)) return $v ? 1.0 : 0.0;
  if (is_int($v) || is_float($v)) return (float)$v;
  if (is_string($v)) {
    $s = jstrim($v);
    if ($s === '') return 0.0;
    if (is_numeric($s)) return (float)$s;
    if (preg_match('/^0x[0-9a-f]+$/iD', $s)) return (float)hexdec($s);
    if (preg_match('/^[+-]?Infinity$/D', $s)) return $s[0] === '-' ? -INF : INF;
    return NAN;
  }
  if (is_array($v)) return !$v ? 0.0 : (count($v) === 1 ? jsnum(jsstr($v)) : NAN);
  return NAN;
}
/** Math.round */
function jsround($x) { return is_finite($x) ? floor($x + 0.5) : $x; }
/** Math.round((Number(v) || 0) * 100) / 100 */
function num($v) {
  $n = jsnum($v);
  if (is_nan($n) || !is_finite($n)) $n = 0.0;
  return jsround($n * 100) / 100;
}
function truthy($v) { return !($v === null || $v === false || $v === 0 || $v === 0.0 || $v === '' || (is_float($v) && is_nan($v))); }
/** a || b */
function orv($a, $b) { return truthy($a) ? $a : $b; }
function numstr($f) {
  if (is_int($f)) return (string)$f;
  if (is_nan($f)) return 'NaN';
  if (is_infinite($f)) return $f > 0 ? 'Infinity' : '-Infinity';
  if ($f == floor($f) && abs($f) < 1e21) return sprintf('%.0f', $f == 0 ? 0 : $f);
  return json_encode($f);
}
/** String(v) */
function jsstr($v) {
  if ($v === null) return 'null';
  if (is_bool($v)) return $v ? 'true' : 'false';
  if (is_int($v) || is_float($v)) return numstr($v);
  if (is_string($v)) return $v;
  if (is_array($v)) return implode(',', array_map(fn($x) => $x === null ? '' : jsstr($x), $v));
  return '[object Object]';
}
function jstrim($s) { return preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/uD', '', $s) ?? trim($s); }
function lower($s) { return mb_strtolower($s, 'UTF-8'); }
function has($o, $k) { return is_object($o) && property_exists($o, $k); }
function g($o, $k) { return is_object($o) ? ($o->$k ?? null) : (is_array($o) ? ($o[$k] ?? null) : null); }
function isDate($v) { return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $v); }
function first($arr, $fn) { foreach ($arr as $x) if ($fn($x)) return $x; return null; }
function some($arr, $fn) { foreach ($arr as $x) if ($fn($x)) return true; return false; }
function filt($arr, $fn) { return array_values(array_filter($arr, $fn)); }
function map($arr, $fn) { return array_map($fn, array_values($arr)); }
function sum($arr, $fn) { $s = 0; foreach ($arr as $x) $s += $fn($x); return $s; }
/** { ...o, ...extra } */
function ext($o, $extra) { return (object)array_merge((array)$o, $extra); }
function sortBy($arr, $cmp) { $arr = array_values($arr); usort($arr, $cmp); return $arr; }
function pad($n) { return str_pad((string)$n, 5, '0', STR_PAD_LEFT); }
/** Date.parse لتاريخ بصيغة YYYY-MM-DD (بتوقيت UTC كما في JavaScript) */
function parseDate($s) {
  if (!is_string($s) || $s === '') return NAN;
  if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $s, $m)) return gmmktime(0, 0, 0, (int)$m[2], (int)$m[3], (int)$m[1]) * 1000.0;
  $t = strtotime($s);
  return $t === false ? NAN : $t * 1000.0;
}
function daysBetween($a, $b) { return jsround((parseDate($b) - parseDate($a)) / 864e5); }
function obj($a) { return (object)$a; }

function normalize($db) {
  $db = is_object($db) ? $db : new \stdClass();
  foreach (COLLECTIONS as $k) if (!isset($db->$k) || !is_array($db->$k)) $db->$k = [];
  foreach (COLLECTIONS as $k) $db->$k = array_values($db->$k);
  $db->sessions = isset($db->sessions) && truthy($db->sessions) ? (object)$db->sessions : new \stdClass();
  $settings = (object)DEFAULT_SETTINGS;
  $settings->counters = new \stdClass();
  if (isset($db->settings) && truthy($db->settings)) foreach ((array)$db->settings as $k => $v) $settings->$k = $v;
  $db->settings = $settings;
  $db->settings->counters = truthy($db->settings->counters ?? null) ? (object)$db->settings->counters : new \stdClass();
  if (!$db->fundSources) foreach (DEFAULT_SOURCES as $i => [$name, $type]) $db->fundSources[] = obj(['id' => 'src' . ($i + 1), 'name' => $name, 'type' => $type, 'accountNo' => '', 'active' => true, 'notes' => '']);
  if (!$db->categories) foreach (DEFAULT_CATEGORIES as $i => [$code, $name]) $db->categories[] = obj(['id' => 'cat' . ($i + 1), 'code' => $code, 'name' => $name, 'active' => true, 'vatApplicable' => true]);
  // ترقية بيانات النسخة الأولى
  foreach ($db->users as $u) if (($u->role ?? null) === 'manager') $u->role = 'admin';
  foreach ($db->expenses as $e) if (!isset($e->attachments) || !is_array($e->attachments)) $e->attachments = [];
  $db->version = 2;
  return $db;
}

/**
 * env: كائن فيه db و save() و uid() و now() و today() و hashPassword(pw) -> ['salt','hash']
 *      و verifyPassword(user, pw) -> bool و putFile(dataUrl) -> id
 */
class Core {
  public $env;
  private $routes = [];
  private $coll;

  public function __construct($env) {
    $this->env = $env;
    $this->coll = class_exists('\Collator') ? new \Collator('ar') : null;
    $this->registerRoutes();
  }

  private function D() { return $this->env->db; }
  private function S() { return $this->env->db->settings; }
  private function today() { return $this->env->today(); }
  private function localeCompare($a, $b) { return $this->coll ? $this->coll->compare($a, $b) : strcmp($a, $b); }
  public function isStaff($u) { return $u->role === 'admin' || $u->role === 'accountant' || $u->role === 'owner'; }
  private function staffOnly($u) { if (!$this->isStaff($u)) fail(403, 'هذه العملية للإدارة فقط'); }
  private function adminOnly($u) { if ($u->role !== 'admin') fail(403, 'هذه العملية لمدير النظام فقط'); }
  private function text($v, $label) { $s = jstrim(jsstr($v ?? '')); if ($s === '') fail(400, "حقل «{$label}» مطلوب"); return $s; }
  private function opt($v) { return jstrim(jsstr($v ?? '')); }
  private function money($v, $label = 'المبلغ') { $n = num($v); if (!($n > 0)) fail(400, "{$label} يجب أن يكون أكبر من صفر"); return $n; }
  private function dateOr($v) { return isDate($v) ? $v : $this->today(); }
  private function nextNo($prefix) { $c = $this->S()->counters; $c->$prefix = (truthy($c->$prefix ?? null) ? $c->$prefix : 0) + 1; return $prefix . '-' . pad($c->$prefix); }
  private function find($coll, $id, $label = 'السجل') { return first($this->D()->$coll, fn($x) => ($x->id ?? null) === $id) ?? fail(404, "{$label} غير موجود"); }
  private function userName($id) { $u = first($this->D()->users, fn($u) => $u->id === $id); return $u && truthy($u->name ?? null) ? $u->name : '—'; }
  private function ccName($id) { $c = first($this->D()->costCenters, fn($x) => $x->id === $id); return $c ? (truthy($c->code ?? null) ? $c->code . ' · ' : '') . $c->name : '—'; }
  private function catName($id) { $c = first($this->D()->categories, fn($x) => $x->id === $id); return $c && truthy($c->name ?? null) ? $c->name : '—'; }
  private function srcName($id) { $x = first($this->D()->fundSources, fn($x) => $x->id === $id); return $x && truthy($x->name ?? null) ? $x->name : ''; }
  // يتحقق من مصدر المبلغ؛ مطلوب ما دام هناك مصادر معرفة
  private function sourceOf($id, $required = true) {
    if (!truthy($id)) { if ($required && some($this->D()->fundSources, fn($x) => ($x->active ?? null) !== false)) fail(400, 'اختر مصدر المبلغ (من أين / إلى أين)'); return null; }
    return $this->find('fundSources', $id, 'مصدر المبلغ')->id;
  }
  public function publicUser($u) {
    return $u ? obj(['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'role' => $u->role, 'roleName' => ROLES[$u->role] ?? null, 'jobTitle' => orv($u->jobTitle ?? null, ''), 'phone' => orv($u->phone ?? null, ''), 'department' => orv($u->department ?? null, ''), 'custodyLimit' => orv($u->custodyLimit ?? null, 0), 'directCustody' => truthy($u->directCustody ?? null), 'active' => ($u->active ?? null) !== false]) : $u;
  }

  private function log($user, $action, $summary, $entity, $entityId) {
    $D = $this->D();
    $D->audit[] = obj(['id' => $this->env->uid(), 'at' => $this->env->now(), 'userId' => $user ? $user->id : null, 'userName' => $user ? $user->name : 'النظام', 'action' => $action, 'summary' => $summary, 'entity' => $entity, 'entityId' => $entityId]);
    if (count($D->audit) > 5000) array_splice($D->audit, 0, count($D->audit) - 5000);
  }
  private function notify($userIds, $text, $link = '') {
    $D = $this->D();
    foreach ((array)$userIds as $userId) if (truthy($userId)) $D->notifications[] = obj(['id' => $this->env->uid(), 'userId' => $userId, 'at' => $this->env->now(), 'text' => $text, 'link' => orv($link, ''), 'read' => false]);
    if (count($D->notifications) > 5000) array_splice($D->notifications, 0, count($D->notifications) - 5000);
  }
  private function staffIds() { return map(filt($this->D()->users, fn($u) => $this->isStaff($u) && ($u->active ?? null) !== false), fn($u) => $u->id); }

  // ---------- مراكز التكلفة (شجرة) ----------
  private function ccDescendants($id) {
    $out = [$id => true];
    $grew = true;
    while ($grew) { $grew = false; foreach ($this->D()->costCenters as $c) if (truthy($c->parentId ?? null) && isset($out[$c->parentId]) && !isset($out[$c->id])) { $out[$c->id] = true; $grew = true; } }
    return $out;
  }
  private function ccTree() {
    $list = $this->D()->costCenters;
    $out = [];
    $key = fn($c) => jsstr(orv($c->code ?? null, $c->name));
    $walk = function ($parentId, $depth) use (&$walk, &$out, $list, $key) {
      $kids = sortBy(filt($list, fn($c) => orv($c->parentId ?? null, null) === $parentId), fn($a, $b) => $this->localeCompare($key($a), $key($b)));
      foreach ($kids as $c) { $out[] = ext($c, ['depth' => $depth]); $walk($c->id, $depth + 1); }
    };
    $walk(null, 0);
    // مراكز يتيمة (أب محذوف)
    foreach ($list as $c) if (!some($out, fn($o) => $o->id === $c->id)) $out[] = ext($c, ['depth' => 0]);
    return $out;
  }

  // ---------- أرصدة العهد ----------
  private function custodyBalance($c) {
    $D = $this->D();
    $txs = filt($D->tx, fn($t) => $t->custodyId === $c->id);
    $confirmed = filt($txs, fn($t) => $t->status === 'confirmed');
    $sumT = fn($types) => num(sum(filt($confirmed, fn($t) => in_array($t->type, $types, true)), fn($t) => $t->amount));
    $exps = filt($D->expenses, fn($e) => $e->custodyId === $c->id && $e->status !== 'rejected');
    $spent = num(sum($exps, fn($e) => $e->amount));
    $pending = filt($exps, fn($e) => $e->status === 'pending');
    $received = $sumT(['issue', 'topup', 'transfer_in', 'reimburse']);
    $returned = $sumT(['return', 'transfer_out']);
    $unsettled = filt($exps, fn($e) => $e->status === 'approved' && !truthy($e->settlementId ?? null));
    $due = $c->dueDate ?? null;
    $overdue = $c->status === 'open' && ((truthy($due) && strcmp($due, $this->today()) < 0) || ($c->kind === 'temporary' && !truthy($due) && daysBetween($c->issueDate, $this->today()) > $this->S()->agingDays));
    return [
      'received' => $received, 'spent' => $spent, 'returned' => $returned, 'balance' => num($received - $returned - $spent),
      'pendingCount' => count($pending), 'pendingAmount' => num(sum($pending, fn($e) => $e->amount)),
      'unsettledCount' => count($unsettled), 'unsettledAmount' => num(sum($unsettled, fn($e) => $e->amount)),
      'pendingTx' => count(filt($txs, fn($t) => $t->status === 'pending')), 'overdue' => $overdue,
    ];
  }
  private function custodyView($c) { return ext($c, array_merge(['kindName' => KINDS[$c->kind] ?? null, 'employeeName' => $this->userName($c->employeeId), 'costCenterName' => $this->ccName($c->costCenterId ?? null)], $this->custodyBalance($c))); }
  private function employeeTotals($userId) {
    $cs = map(filt($this->D()->custodies, fn($c) => $c->employeeId === $userId), fn($c) => $this->custodyView($c));
    $open = filt($cs, fn($c) => $c->status === 'open');
    $t = fn($k) => num(sum($cs, fn($c) => $c->$k));
    return [
      'openCount' => count($open), 'received' => $t('received'), 'spent' => $t('spent'), 'returned' => $t('returned'), 'balance' => $t('balance'),
      'pendingCount' => sum($cs, fn($c) => $c->pendingCount), 'pendingAmount' => $t('pendingAmount'),
      'overdueCount' => count(filt($open, fn($c) => $c->overdue)),
      'assetsCount' => count(filt($this->D()->assets, fn($a) => ($a->holderId ?? null) === $userId && $a->status === 'assigned')),
    ];
  }
  private function canAccessCustody($user, $c) { if (!$this->isStaff($user) && $c->employeeId !== $user->id) fail(403, 'غير مسموح'); }

  private function expenseView($e) {
    $D = $this->D();
    $cu = first($D->custodies, fn($c) => $c->id === $e->custodyId);
    $extra = ['employeeName' => $this->userName($e->employeeId), 'costCenterName' => $this->ccName($e->costCenterId ?? null), 'categoryName' => $this->catName($e->categoryId ?? null),
      'custodyNo' => $cu && truthy($cu->no ?? null) ? $cu->no : '—', 'statusName' => EXPENSE_STATUS[$e->status] ?? null];
    if (truthy($e->settlementId ?? null)) { $s = first($D->settlements, fn($s) => $s->id === $e->settlementId); if ($s) $extra['settlementNo'] = $s->no ?? null; }
    else $extra['settlementNo'] = null;
    return ext($e, $extra);
  }
  private function filterExpenses($q, $user) {
    $list = $this->D()->expenses;
    $emp = $this->isStaff($user) ? g($q, 'employeeId') : $user->id;
    if (truthy($emp)) $list = filt($list, fn($e) => $e->employeeId === $emp);
    if (truthy(g($q, 'custodyId'))) $list = filt($list, fn($e) => $e->custodyId === g($q, 'custodyId'));
    if (truthy(g($q, 'costCenterId'))) { $ids = $this->ccDescendants(g($q, 'costCenterId')); $list = filt($list, fn($e) => isset($e->costCenterId) && isset($ids[$e->costCenterId])); }
    if (truthy(g($q, 'categoryId'))) $list = filt($list, fn($e) => ($e->categoryId ?? null) === g($q, 'categoryId'));
    if (truthy(g($q, 'status'))) $list = filt($list, fn($e) => $e->status === g($q, 'status'));
    if (truthy(g($q, 'from'))) $list = filt($list, fn($e) => strcmp($e->date, jsstr(g($q, 'from'))) >= 0);
    if (truthy(g($q, 'to'))) $list = filt($list, fn($e) => strcmp($e->date, jsstr(g($q, 'to'))) <= 0);
    if (g($q, 'settled') === 'no') $list = filt($list, fn($e) => !truthy($e->settlementId ?? null));
    if (truthy(g($q, 'q'))) { $s = lower(jsstr(g($q, 'q'))); $list = filt($list, fn($e) => some([$e->no ?? null, $e->description ?? null, $e->vendor ?? null, $e->invoiceNo ?? null], fn($v) => str_contains(lower(jsstr(orv($v, ''))), $s))); }
    return map(sortBy($list, fn($a, $b) => strcmp($b->date . $b->createdAt, $a->date . $a->createdAt)), fn($e) => $this->expenseView($e));
  }
  private function computeVat($amount, $vatIncluded) {
    if (!truthy($vatIncluded)) return 0;
    $r = jsnum($this->S()->vatRate); if (is_nan($r)) $r = 0.0;
    return num($amount * $r / (100 + $r));
  }
  private function saveAttachments($list) {
    $out = [];
    foreach (array_slice(is_array($list) ? array_values($list) : [], 0, 6) as $a) {
      if (is_string($a) && str_starts_with($a, 'data:')) $out[] = $this->env->putFile($a);
      else if (is_string($a) && $a !== '') $out[] = $a;
    }
    return $out;
  }
  private function addTx($user, $custody, $type, $amount, $extra = []) {
    $x = fn($k) => $extra[$k] ?? null;
    $t = obj([
      'id' => $this->env->uid(), 'custodyId' => $custody->id, 'employeeId' => $custody->employeeId, 'type' => $type, 'amount' => num($amount), 'date' => $this->dateOr($x('date')),
      'method' => orv($x('method'), 'نقداً'), 'ref' => $this->opt($x('ref')), 'note' => $this->opt($x('note')), 'status' => orv($x('status'), 'confirmed'), 'sourceId' => orv($x('sourceId'), null),
      'createdBy' => $user ? $user->id : null, 'createdAt' => $this->env->now(), 'relatedId' => orv($x('relatedId'), null),
    ]);
    if (truthy($x('settlementId'))) $t->settlementId = $x('settlementId');
    $this->D()->tx[] = $t;
    return $t;
  }
  private function createCustody($user, $b) {
    $emp = first($this->D()->users, fn($u) => $u->id === g($b, 'employeeId') && ($u->active ?? null) !== false) ?? fail(400, 'اختر الموظف');
    $kind = isset(KINDS[g($b, 'kind')]) && is_string(g($b, 'kind')) ? g($b, 'kind') : 'temporary';
    $amount = $this->money(g($b, 'amount'), 'مبلغ العهدة');
    $sourceId = $this->sourceOf(g($b, 'sourceId'));
    if (truthy(g($b, 'costCenterId'))) $this->find('costCenters', g($b, 'costCenterId'), 'مركز التكلفة');
    if (truthy($emp->custodyLimit ?? null)) {
      $bal = $this->employeeTotals($emp->id)['balance'];
      if ($bal + $amount > $emp->custodyLimit && !truthy(g($b, 'force'))) fail(400, 'يتجاوز الحد الأعلى لعهدة الموظف (' . jsstr($emp->custodyLimit) . '). الرصيد الحالي ' . jsstr($bal));
    }
    $c = obj([
      'id' => $this->env->uid(), 'no' => $this->nextNo('CU'), 'employeeId' => $emp->id, 'kind' => $kind, 'purpose' => $this->text(g($b, 'purpose'), 'الغرض من العهدة'), 'costCenterId' => orv(g($b, 'costCenterId'), null),
      'issueDate' => $this->dateOr(g($b, 'issueDate')), 'dueDate' => $kind === 'temporary' && isDate(g($b, 'dueDate')) ? g($b, 'dueDate') : null,
      'status' => 'open', 'createdBy' => $user->id, 'createdAt' => $this->env->now(), 'closedAt' => null, 'notes' => $this->opt(g($b, 'notes')),
    ]);
    $direct = truthy(g($b, 'direct'));
    if ($direct) $c->direct = true;
    $this->D()->custodies[] = $c;
    $this->addTx($user, $c, 'issue', $amount, ['date' => $c->issueDate, 'method' => g($b, 'method'), 'ref' => g($b, 'ref'), 'note' => $direct ? 'تعميد مباشر' : 'صرف العهدة', 'sourceId' => $sourceId]);
    if (!$direct) $this->notify($emp->id, 'تم صرف ' . KINDS[$kind] . " رقم {$c->no} بمبلغ " . jsstr($amount) . " — {$c->purpose}", '#/custody/' . $c->id);
    $this->log($user, 'إنشاء عهدة', "{$c->no} لـ {$emp->name} بمبلغ " . jsstr($amount) . ($sourceId ? ' من ' . $this->srcName($sourceId) : ''), 'custody', $c->id);
    if (g($b, 'coverDeficit') !== false) $this->coverDeficits($user, $c, $amount);
    return $c;
  }
  // الموظف دفع من جيبه (عهدة سابقة بالسالب): يُغطّى العجز تلقائياً من العهدة الجديدة بتحويل داخلي
  private function coverDeficits($user, $c, $amount) {
    $left = $amount; $covered = 0;
    $olds = sortBy(filt($this->D()->custodies, fn($x) => $x->id !== $c->id && $x->employeeId === $c->employeeId && $x->status === 'open'), fn($a, $b) => strcmp($a->issueDate . $a->createdAt, $b->issueDate . $b->createdAt));
    foreach ($olds as $o) {
      $need = num(-$this->custodyBalance($o)['balance']);
      $cover = num(min($need, $left));
      if (!($cover > 0)) continue;
      $out = $this->addTx($user, $c, 'transfer_out', $cover, ['date' => $c->issueDate, 'method' => 'تسوية داخلية', 'note' => "تغطية عجز العهدة {$o->no} (دفعه الموظف من جيبه)"]);
      $inn = $this->addTx($user, $o, 'transfer_in', $cover, ['date' => $c->issueDate, 'method' => 'تسوية داخلية', 'note' => "تغطية العجز من العهدة {$c->no}", 'relatedId' => $out->id]);
      $out->relatedId = $inn->id;
      $left = num($left - $cover); $covered = num($covered + $cover);
      $this->log($user, 'تغطية عجز', jsstr($cover) . " من {$c->no} إلى {$o->no}", 'custody', $o->id);
      if (!$left) break;
    }
    if ($covered) { $c->coveredDeficit = $covered; $this->notify($c->employeeId, 'تم خصم ' . jsstr($covered) . " من العهدة {$c->no} لتعويض ما دفعته من جيبك سابقاً — المتبقي معك " . jsstr(num($amount - $covered)), '#/custody/' . $c->id); }
  }

  // ---------- التقارير ----------
  private static function col($key, $label, $type = 'text') { return obj(['key' => $key, 'label' => $label, 'type' => $type]); }
  private static function sumCols($rows, $keys) {
    $out = [];
    foreach ($keys as $k) $out[$k] = num(sum($rows, function ($r) use ($k) { $n = jsnum(g($r, $k)); return is_nan($n) ? 0 : $n; }));
    return obj($out);
  }
  public function reportData($name, $q, $user) {
    $D = $this->D();
    $from = truthy(g($q, 'from')) ? jsstr(g($q, 'from')) : null;
    $to = truthy(g($q, 'to')) ? jsstr(g($q, 'to')) : null;
    $inRange = fn($d) => ($from === null || strcmp($d, $from) >= 0) && ($to === null || strcmp($d, $to) <= 0);
    $period = $from !== null || $to !== null ? 'الفترة: ' . ($from ?? 'البداية') . ' — ' . ($to ?? 'اليوم') : 'كل الفترات';
    $col = fn(...$a) => self::col(...$a);
    $sign = fn($t) => TX_TYPES[$t->type]['sign'];
    $custNo = function ($id) use ($D) { $c = first($D->custodies, fn($c) => $c->id === $id); return $c ? ($c->no ?? null) : null; };
    if ($name === 'statement') {
      $empId = $this->isStaff($user) ? g($q, 'employeeId') : $user->id;
      $emp = first($D->users, fn($u) => $u->id === $empId) ?? fail(400, 'اختر الموظف');
      $custIds = [];
      foreach ($D->custodies as $c) if ($c->employeeId === $emp->id && (!truthy(g($q, 'custodyId')) || $c->id === g($q, 'custodyId'))) $custIds[$c->id] = true;
      $items = [];
      foreach (filt($D->tx, fn($t) => isset($custIds[$t->custodyId]) && $t->status === 'confirmed') as $t)
        $items[] = ['date' => $t->date, 'at' => $t->createdAt, 'no' => $custNo($t->custodyId), 'desc' => TX_TYPES[$t->type]['label'] . (truthy($t->sourceId ?? null) ? ($sign($t) > 0 ? ' — من: ' : ' — إلى: ') . $this->srcName($t->sourceId) : '') . (truthy($t->note ?? null) && $t->note !== 'صرف العهدة' ? ' — ' . $t->note : ''), 'in' => $sign($t) > 0 ? $t->amount : 0, 'out' => $sign($t) < 0 ? $t->amount : 0];
      foreach (filt($D->expenses, fn($e) => isset($custIds[$e->custodyId]) && $e->status !== 'rejected') as $e)
        $items[] = ['date' => $e->date, 'at' => $e->createdAt, 'no' => $e->no, 'desc' => $this->catName($e->categoryId ?? null) . ": {$e->description} (" . $this->ccName($e->costCenterId ?? null) . ')' . ($e->status === 'pending' ? ' — بانتظار الاعتماد' : ''), 'in' => 0, 'out' => $e->amount];
      $items = sortBy($items, fn($a, $b) => strcmp($a['date'] . $a['at'], $b['date'] . $b['at']));
      $opening = sum(filt($items, fn($i) => $from !== null && strcmp($i['date'], $from) < 0), fn($i) => $i['in'] - $i['out']);
      $run = $opening;
      $rows = [];
      foreach (filt($items, fn($i) => $inRange($i['date'])) as $i) { $run = num($run + $i['in'] - $i['out']); $i['balance'] = $run; $rows[] = obj($i); }
      if ($opening) array_unshift($rows, obj(['date' => g($q, 'from'), 'no' => '', 'desc' => 'رصيد افتتاحي', 'in' => 0, 'out' => 0, 'balance' => num($opening)]));
      return obj(['title' => "كشف حساب عهدة — {$emp->name}", 'subtitle' => $period, 'columns' => [$col('date', 'التاريخ', 'date'), $col('no', 'المرجع'), $col('desc', 'البيان'), $col('in', 'وارد', 'money'), $col('out', 'صادر', 'money'), $col('balance', 'الرصيد', 'money')], 'rows' => $rows, 'totals' => obj(['in' => num(sum($rows, fn($r) => $r->in)), 'out' => num(sum($rows, fn($r) => $r->out)), 'balance' => $run])]);
    }
    $this->staffOnly($user);
    if ($name === 'balances') {
      $rows = filt(map(filt($D->users, fn($u) => $u->role !== 'admin' || some($D->custodies, fn($c) => $c->employeeId === $u->id)), fn($u) => obj(array_merge(['name' => $u->name, 'job' => orv($u->jobTitle ?? null, '')], $this->employeeTotals($u->id)))), fn($r) => truthy($r->received) || truthy($r->openCount));
      return obj(['title' => 'أرصدة العهد حسب الموظف', 'subtitle' => 'حتى تاريخه', 'columns' => [$col('name', 'الموظف'), $col('job', 'الوظيفة'), $col('openCount', 'عهد مفتوحة', 'num'), $col('received', 'المستلم', 'money'), $col('spent', 'المصروف', 'money'), $col('returned', 'المردود', 'money'), $col('balance', 'الرصيد المتبقي', 'money'), $col('pendingAmount', 'بانتظار الاعتماد', 'money')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['openCount', 'received', 'spent', 'returned', 'balance', 'pendingAmount'])]);
    }
    if ($name === 'cost-centers') {
      $exps = filt($D->expenses, fn($e) => $e->status !== 'rejected' && $inRange($e->date) && (!truthy(g($q, 'status')) || $e->status === g($q, 'status')));
      $own = [];
      foreach ($exps as $e) { $k = truthy($e->costCenterId ?? null) ? $e->costCenterId : '_'; $own[$k] = num(($own[$k] ?? 0) + $e->amount); }
      $rows = map($this->ccTree(), function ($c) use ($own) {
        $ids = $this->ccDescendants($c->id);
        $spent = num(sum(array_keys($ids), fn($id) => $own[$id] ?? 0));
        $budget = $c->budget ?? null;
        return obj(['code' => orv($c->code ?? null, ''), 'name' => str_repeat("\u{2003}", $c->depth) . $c->name, 'type' => CC_TYPES[$c->type ?? ''] ?? '', 'budget' => orv($budget, 0), 'spent' => $spent, 'remaining' => truthy($budget) ? num($budget - $spent) : '', 'used' => truthy($budget) ? numstr(jsround($spent / $budget * 100)) . '%' : '', '_depth' => $c->depth]);
      });
      if (truthy($own['_'] ?? null)) $rows[] = obj(['code' => '', 'name' => 'بدون مركز تكلفة', 'type' => '', 'budget' => 0, 'spent' => $own['_'], 'remaining' => '', 'used' => '', '_depth' => 0]);
      $top = filt($rows, fn($r) => $r->_depth === 0);
      return obj(['title' => 'المصروفات حسب مراكز التكلفة', 'subtitle' => $period . ' — يشمل المراكز الفرعية', 'columns' => [$col('code', 'الرمز'), $col('name', 'مركز التكلفة'), $col('type', 'النوع'), $col('budget', 'الميزانية', 'money'), $col('spent', 'المصروف', 'money'), $col('remaining', 'المتبقي', 'money'), $col('used', 'نسبة الصرف')], 'rows' => $rows, 'totals' => obj(['spent' => num(sum($top, fn($r) => $r->spent)), 'budget' => num(sum($top, fn($r) => $r->budget))])]);
    }
    if ($name === 'categories') {
      $ccIds = truthy(g($q, 'costCenterId')) ? $this->ccDescendants(g($q, 'costCenterId')) : null;
      $exps = filt($D->expenses, fn($e) => $e->status !== 'rejected' && $inRange($e->date) && ($ccIds === null || (isset($e->costCenterId) && isset($ccIds[$e->costCenterId]))));
      $rows = filt(map($D->categories, function ($c) use ($exps) {
        $xs = filt($exps, fn($e) => ($e->categoryId ?? null) === $c->id);
        $total = num(sum($xs, fn($e) => $e->amount)); $vat = num(sum($xs, fn($e) => orv($e->vat ?? null, 0)));
        return obj(['code' => $c->code ?? null, 'name' => $c->name, 'count' => count($xs), 'net' => num($total - $vat), 'vat' => $vat, 'total' => $total]);
      }), fn($r) => $r->count > 0);
      return obj(['title' => 'المصروفات حسب البنود (الحسابات)', 'subtitle' => $period . (truthy(g($q, 'costCenterId')) ? ' — ' . $this->ccName(g($q, 'costCenterId')) : ''), 'columns' => [$col('code', 'رقم الحساب'), $col('name', 'البند'), $col('count', 'العدد', 'num'), $col('net', 'الصافي', 'money'), $col('vat', 'الضريبة', 'money'), $col('total', 'الإجمالي', 'money')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['count', 'net', 'vat', 'total'])]);
    }
    if ($name === 'expenses') {
      $rows = map($this->filterExpenses($q, $user), fn($e) => obj(['date' => $e->date, 'no' => $e->no, 'employee' => $e->employeeName, 'cc' => $e->costCenterName, 'category' => $e->categoryName, 'description' => $e->description, 'vendor' => orv($e->vendor ?? null, ''), 'invoice' => orv($e->invoiceNo ?? null, ''), 'net' => num($e->amount - orv($e->vat ?? null, 0)), 'vat' => orv($e->vat ?? null, 0), 'total' => $e->amount, 'status' => $e->statusName]));
      return obj(['title' => 'سجل المصروفات التفصيلي', 'subtitle' => $period, 'columns' => [$col('date', 'التاريخ', 'date'), $col('no', 'الرقم'), $col('employee', 'الموظف'), $col('cc', 'مركز التكلفة'), $col('category', 'البند'), $col('description', 'البيان'), $col('vendor', 'المورد'), $col('invoice', 'رقم الفاتورة'), $col('net', 'الصافي', 'money'), $col('vat', 'الضريبة', 'money'), $col('total', 'الإجمالي', 'money'), $col('status', 'الحالة')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['net', 'vat', 'total'])]);
    }
    if ($name === 'vat') {
      $rows = map(sortBy(filt($D->expenses, fn($e) => $e->status === 'approved' && ($e->vat ?? 0) > 0 && $inRange($e->date)), fn($a, $b) => strcmp($a->date, $b->date)), fn($e) => obj(['date' => $e->date, 'no' => $e->no, 'vendor' => orv($e->vendor ?? null, ''), 'vendorVat' => orv($e->vendorVat ?? null, ''), 'invoice' => orv($e->invoiceNo ?? null, ''), 'net' => num($e->amount - $e->vat), 'vat' => $e->vat, 'total' => $e->amount]));
      return obj(['title' => 'تقرير ضريبة المدخلات', 'subtitle' => $period . ' — المصروفات المعتمدة فقط', 'columns' => [$col('date', 'التاريخ', 'date'), $col('no', 'الرقم'), $col('vendor', 'المورد'), $col('vendorVat', 'الرقم الضريبي للمورد'), $col('invoice', 'رقم الفاتورة'), $col('net', 'الصافي', 'money'), $col('vat', 'الضريبة', 'money'), $col('total', 'الإجمالي', 'money')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['net', 'vat', 'total'])]);
    }
    if ($name === 'aging') {
      $rows = sortBy(map(map(filt($D->custodies, fn($c) => $c->status === 'open'), fn($c) => $this->custodyView($c)), fn($c) => obj(['no' => $c->no, 'employee' => $c->employeeName, 'kind' => $c->kindName, 'purpose' => $c->purpose, 'issueDate' => $c->issueDate, 'dueDate' => orv($c->dueDate ?? null, ''), 'days' => daysBetween($c->issueDate, $this->today()), 'balance' => $c->balance, 'state' => $c->overdue ? 'متأخرة' : 'ضمن المدة'])), fn($a, $b) => $b->days <=> $a->days);
      return obj(['title' => 'أعمار العهد المفتوحة', 'subtitle' => 'العهد المؤقتة تعتبر متأخرة بعد تاريخ التسوية أو بعد ' . jsstr($this->S()->agingDays) . ' يوماً', 'columns' => [$col('no', 'رقم العهدة'), $col('employee', 'الموظف'), $col('kind', 'النوع'), $col('purpose', 'الغرض'), $col('issueDate', 'تاريخ الصرف', 'date'), $col('dueDate', 'موعد التسوية', 'date'), $col('days', 'عمر العهدة (يوم)', 'num'), $col('balance', 'الرصيد', 'money'), $col('state', 'الحالة')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['balance'])]);
    }
    if ($name === 'assets') {
      $rows = map(filt($D->assets, fn($a) => !truthy(g($q, 'holderId')) || ($a->holderId ?? null) === g($q, 'holderId')), fn($a) => obj(['no' => $a->no, 'name' => $a->name, 'category' => $a->category, 'serial' => orv($a->serial ?? null, ''), 'holder' => truthy($a->holderId ?? null) ? $this->userName($a->holderId) : '—', 'cc' => $this->ccName($a->costCenterId ?? null), 'status' => ASSET_STATUS[$a->status] ?? null, 'ack' => $a->status === 'assigned' ? (truthy($a->acknowledged ?? null) ? 'نعم' : 'لا') : '', 'value' => orv($a->value ?? null, 0)]));
      return obj(['title' => 'سجل العهد العينية', 'subtitle' => 'حتى تاريخه', 'columns' => [$col('no', 'الرقم'), $col('name', 'الأصل'), $col('category', 'الفئة'), $col('serial', 'الرقم التسلسلي'), $col('holder', 'بعهدة'), $col('cc', 'مركز التكلفة'), $col('status', 'الحالة'), $col('ack', 'أقر بالاستلام'), $col('value', 'القيمة', 'money')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['value'])]);
    }
    if ($name === 'settlements') {
      $rows = map(sortBy(filt($D->settlements, fn($s) => $inRange($s->date)), fn($a, $b) => strcmp($b->date, $a->date)), fn($s) => obj(['date' => $s->date, 'no' => $s->no, 'custody' => $custNo($s->custodyId), 'employee' => $this->userName($s->employeeId), 'count' => count($s->expenseIds), 'total' => $s->total, 'returned' => orv($s->returned ?? null, 0), 'reimbursed' => orv($s->reimbursed ?? null, 0), 'replenished' => orv($s->replenished ?? null, 0), 'closed' => truthy($s->closed ?? null) ? 'نعم' : 'لا']));
      return obj(['title' => 'سجل تسويات العهد', 'subtitle' => $period, 'columns' => [$col('date', 'التاريخ', 'date'), $col('no', 'رقم التسوية'), $col('custody', 'العهدة'), $col('employee', 'الموظف'), $col('count', 'عدد المصروفات', 'num'), $col('total', 'إجمالي المصروفات', 'money'), $col('returned', 'رد نقدي', 'money'), $col('reimbursed', 'صرف فرق', 'money'), $col('replenished', 'تعويض', 'money'), $col('closed', 'أغلقت العهدة')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['total', 'returned', 'reimbursed', 'replenished'])]);
    }
    if ($name === 'sources') {
      $txs = filt($D->tx, fn($t) => $t->status === 'confirmed' && $inRange($t->date) && !in_array($t->type, ['transfer_in', 'transfer_out'], true));
      $rows = map($D->fundSources, function ($src) use ($txs, $sign) {
        $mine = filt($txs, fn($t) => ($t->sourceId ?? null) === $src->id);
        $out = num(sum(filt($mine, fn($t) => $sign($t) > 0), fn($t) => $t->amount));
        $back = num(sum(filt($mine, fn($t) => $sign($t) < 0), fn($t) => $t->amount));
        return obj(['name' => $src->name, 'type' => SOURCE_TYPES[$src->type ?? ''] ?? '', 'count' => count($mine), 'out' => $out, 'back' => $back, 'net' => num($out - $back)]);
      });
      $unk = filt($txs, fn($t) => !truthy($t->sourceId ?? null));
      if ($unk) { $out = num(sum(filt($unk, fn($t) => $sign($t) > 0), fn($t) => $t->amount)); $back = num(sum(filt($unk, fn($t) => $sign($t) < 0), fn($t) => $t->amount)); $rows[] = obj(['name' => 'غير محدد', 'type' => '', 'count' => count($unk), 'out' => $out, 'back' => $back, 'net' => num($out - $back)]); }
      return obj(['title' => 'مصادر أموال العهد', 'subtitle' => $period . ' — من أين صُرفت العهد وإلى أين رُدّت', 'columns' => [$col('name', 'المصدر'), $col('type', 'النوع'), $col('count', 'عدد الحركات', 'num'), $col('out', 'صُرف للموظفين', 'money'), $col('back', 'رُدّ إليه', 'money'), $col('net', 'الصافي لدى الموظفين', 'money')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['count', 'out', 'back', 'net'])]);
    }
    if ($name === 'source-ledger') {
      $rows = map(sortBy(filt($D->tx, fn($t) => $t->status === 'confirmed' && $inRange($t->date) && (!truthy(g($q, 'sourceId')) || ($t->sourceId ?? null) === g($q, 'sourceId')) && (!truthy(g($q, 'employeeId')) || $t->employeeId === g($q, 'employeeId')) && !in_array($t->type, ['transfer_in', 'transfer_out'], true)),
        fn($a, $b) => strcmp($a->date . $a->createdAt, $b->date . $b->createdAt)),
        fn($t) => obj(['date' => $t->date, 'source' => orv($this->srcName($t->sourceId ?? null), 'غير محدد'), 'employee' => $this->userName($t->employeeId), 'custody' => $custNo($t->custodyId), 'type' => TX_TYPES[$t->type]['label'], 'method' => $t->method, 'ref' => $t->ref, 'out' => $sign($t) > 0 ? $t->amount : 0, 'back' => $sign($t) < 0 ? $t->amount : 0]));
      return obj(['title' => 'حركة أموال العهد بالتفصيل', 'subtitle' => $period . (truthy(g($q, 'sourceId')) ? ' — ' . $this->srcName(g($q, 'sourceId')) : ''), 'columns' => [$col('date', 'التاريخ', 'date'), $col('source', 'المصدر'), $col('employee', 'الموظف'), $col('custody', 'العهدة'), $col('type', 'الحركة'), $col('method', 'الطريقة'), $col('ref', 'المرجع'), $col('out', 'صُرف', 'money'), $col('back', 'رُدّ', 'money')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['out', 'back'])]);
    }
    if ($name === 'checkins') {
      $f = $from ?? $this->today(); $t2 = $to ?? $this->today();
      $list = filt($D->checkins, fn($c) => strcmp(substr($c->at, 0, 10), $f) >= 0 && strcmp(substr($c->at, 0, 10), $t2) <= 0);
      $rows = map(filt($D->users, fn($u) => $u->role === 'employee' && ($u->active ?? null) !== false), function ($u) use ($list) {
        $mine = filt($list, fn($c) => $c->employeeId === $u->id);
        $ats = map($mine, fn($c) => $c->at); sort($ats, SORT_STRING); $last = $ats ? end($ats) : null;
        return obj(['name' => $u->name, 'yes' => count(filt($mine, fn($c) => $c->answer === 'yes')), 'no' => count(filt($mine, fn($c) => $c->answer === 'no')), 'total' => count($mine), 'last' => truthy($last) ? preg_replace('/T/', ' ', substr($last, 0, 16), 1) : 'لم يرد']);
      });
      return obj(['title' => 'تفاعل الموظفين مع تنبيهات المصروفات', 'subtitle' => "من {$f} إلى {$t2}", 'columns' => [$col('name', 'الموظف'), $col('yes', 'أجاب: صرفت', 'num'), $col('no', 'أجاب: لم أصرف', 'num'), $col('total', 'إجمالي الردود', 'num'), $col('last', 'آخر رد')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['yes', 'no', 'total'])]);
    }
    if ($name === 'monthly') {
      $ym = fn($y, $m) => sprintf('%d-%02d', $y, $m);
      $to = isDate(g($q, 'to')) ? g($q, 'to') : $this->today();
      [$y, $m] = array_map('intval', explode('-', substr($to, 0, 7)));
      $m -= 5; while ($m < 1) { $m += 12; $y--; }
      $from = isDate(g($q, 'from')) ? g($q, 'from') : $ym($y, $m) . '-01';
      $months = [];
      [$y, $m] = array_map('intval', explode('-', substr($from, 0, 7)));
      for (;;) { $mo = $ym($y, $m); $months[] = $mo; if (strcmp($mo, substr($to, 0, 7)) >= 0 || count($months) >= 24) break; if (++$m > 12) { $m = 1; $y++; } }
      $exps = filt($D->expenses, fn($e) => $e->status !== 'rejected' && strcmp($e->date, $from) >= 0 && strcmp($e->date, $to) <= 0);
      $rows = filt(map($D->categories, function ($c) use ($exps, $months) {
        $r = ['code' => $c->code ?? null, 'name' => $c->name];
        $t = 0;
        foreach ($months as $mo) { $v = num(sum(filt($exps, fn($e) => ($e->categoryId ?? null) === $c->id && substr($e->date, 0, 7) === $mo), fn($e) => $e->amount)); $r['m' . $mo] = $v; $t += $v; }
        $r['total'] = num($t);
        return obj($r);
      }), fn($r) => truthy($r->total));
      $mcols = map($months, fn($mo) => $col('m' . $mo, $mo, 'money'));
      return obj(['title' => 'المصروفات الشهرية حسب البنود', 'subtitle' => "من {$from} إلى {$to}", 'columns' => array_merge([$col('code', 'رقم الحساب'), $col('name', 'البند')], $mcols, [$col('total', 'الإجمالي', 'money')]), 'rows' => $rows, 'totals' => self::sumCols($rows, array_merge(map($months, fn($mo) => 'm' . $mo), ['total']))]);
    }
    if ($name === 'employee-activity') {
      $exps = filt($D->expenses, fn($e) => $inRange($e->date));
      $rows = sortBy(map(filt($D->users, fn($u) => some($exps, fn($e) => $e->employeeId === $u->id)), function ($u) use ($exps) {
        $xs = filt($exps, fn($e) => $e->employeeId === $u->id);
        $by = fn($st) => num(sum(filt($xs, fn($e) => $e->status === $st), fn($e) => $e->amount));
        $valid = filt($xs, fn($e) => $e->status !== 'rejected');
        $spent = num(sum($valid, fn($e) => $e->amount));
        $dates = map($xs, fn($e) => $e->date); sort($dates, SORT_STRING);
        return obj(['name' => $u->name, 'count' => count($xs), 'spent' => $spent, 'approved' => $by('approved'), 'pending' => $by('pending'), 'rejected' => $by('rejected'), 'avg' => $valid ? num($spent / count($valid)) : 0, 'receipts' => numstr(jsround(count(filt($xs, fn($e) => !empty($e->attachments))) / count($xs) * 100)) . '%', 'last' => end($dates)]);
      }), fn($a, $b) => $b->spent <=> $a->spent);
      return obj(['title' => 'نشاط الموظفين في المصروفات', 'subtitle' => $period, 'columns' => [$col('name', 'الموظف'), $col('count', 'عدد المصروفات', 'num'), $col('spent', 'المصروف', 'money'), $col('approved', 'المعتمد', 'money'), $col('pending', 'بانتظار الاعتماد', 'money'), $col('rejected', 'المرفوض', 'money'), $col('avg', 'متوسط المصروف', 'money'), $col('receipts', 'نسبة الفواتير المرفقة'), $col('last', 'آخر مصروف', 'date')], 'rows' => $rows, 'totals' => self::sumCols($rows, ['count', 'spent', 'approved', 'pending', 'rejected'])]);
    }
    fail(404, 'التقرير غير موجود');
  }

  // ---------- المسارات ----------
  // ----- تصحيح الأخطاء: دوال مساعدة -----
  private function refreshSettlement($id) {
    $D = $this->D();
    $s = first($D->settlements, fn($x) => $x->id === $id);
    if (!$s) return;
    $s->expenseIds = array_values(array_filter($s->expenseIds, fn($eid) => some($D->expenses, fn($e) => $e->id === $eid)));
    $s->total = num(sum(filt($D->expenses, fn($e) => in_array($e->id, $s->expenseIds, true)), fn($e) => $e->amount));
  }
  private function settlementTx($s) {
    return filt($this->D()->tx, fn($t) => $t->custodyId === $s->custodyId && ((($t->settlementId ?? null) === $s->id) || (!truthy($t->settlementId ?? null) && str_contains(jsstr($t->note ?? ''), $s->no) && preg_match('/التسوية|تسوية/u', jsstr($t->note ?? '')))));
  }
  private function settlementOfTx($t) { return first($this->D()->settlements, fn($s) => some($this->settlementTx($s), fn($y) => $y->id === $t->id)); }
  private function removeTx($ids) {
    $D = $this->D();
    $all = array_fill_keys($ids, true);
    foreach ($D->tx as $t) if (isset($all[$t->id]) && truthy($t->relatedId ?? null)) $all[$t->relatedId] = true;
    $D->tx = filt($D->tx, fn($t) => !isset($all[$t->id]));
    return count($all);
  }
  private function removeCustody($user, $c) {
    $D = $this->D();
    $txIds = map(filt($D->tx, fn($t) => $t->custodyId === $c->id), fn($t) => $t->id);
    $received = $this->custodyBalance($c)['received'];
    $nExp = count(filt($D->expenses, fn($e) => $e->custodyId === $c->id));
    $this->removeTx($txIds);
    $D->expenses = filt($D->expenses, fn($e) => $e->custodyId !== $c->id);
    $D->settlements = filt($D->settlements, fn($s) => $s->custodyId !== $c->id);
    $D->requests = filt($D->requests, fn($r) => !(($r->custodyId ?? null) === $c->id && truthy($r->direct ?? null)));
    foreach ($D->requests as $r) if (($r->custodyId ?? null) === $c->id) $r->custodyId = null;
    $D->custodies = filt($D->custodies, fn($x) => $x->id !== $c->id);
    $this->log($user, 'حذف عهدة', "{$c->no} لـ " . $this->userName($c->employeeId) . ' — مستلم ' . jsstr($received) . "، {$nExp} مصروف", 'custody', $c->id);
  }

  private function on($method, $pattern, $fn) {
    $this->routes[] = ['method' => $method, 're' => '#^' . preg_replace('/:(\w+)/', '(?P<$1>[^/]+)', $pattern) . '$#D', 'fn' => $fn];
  }

  private function registerRoutes() {
    $D = fn() => $this->D();
    $S = fn() => $this->S();

    $this->on('GET', '/api/bootstrap', fn($user) => obj([
      'user' => $this->publicUser($user), 'settings' => $S(), 'roles' => ROLES, 'kinds' => KINDS, 'txTypes' => TX_TYPES, 'assetStatus' => ASSET_STATUS, 'assetMoves' => ASSET_MOVES, 'ccTypes' => CC_TYPES, 'assetCategories' => ASSET_CATEGORIES, 'expenseStatus' => EXPENSE_STATUS,
      'costCenters' => $this->ccTree(), 'categories' => $D()->categories, 'fundSources' => $D()->fundSources, 'sourceTypes' => SOURCE_TYPES,
      'users' => $this->isStaff($user) ? map($D()->users, fn($u) => $this->publicUser($u)) : [$this->publicUser($user)],
      'unread' => count(filt($D()->notifications, fn($n) => $n->userId === $user->id && !truthy($n->read ?? null))),
    ]));

    $this->on('GET', '/api/dashboard', function ($user) use ($D, $S) {
      $this->staffOnly($user);
      $open = map(filt($D()->custodies, fn($c) => $c->status === 'open'), fn($c) => $this->custodyView($c));
      $exps = filt($D()->expenses, fn($e) => $e->status !== 'rejected');
      $month = substr($this->today(), 0, 7);
      $monthSpent = num(sum(filt($exps, fn($e) => substr($e->date, 0, 7) === $month), fn($e) => $e->amount));
      $employees = map(filt($D()->users, fn($u) => ($u->active ?? null) !== false && ($u->role === 'employee' || some($D()->custodies, fn($c) => $c->employeeId === $u->id))), function ($u) use ($D) {
        $ats = map(filt($D()->checkins, fn($c) => $c->employeeId === $u->id), fn($c) => $c->at); sort($ats, SORT_STRING);
        return ext($this->publicUser($u), array_merge($this->employeeTotals($u->id), ['lastCheckin' => $ats ? orv(end($ats), null) : null]));
      });
      $ccRows = filt($this->reportData('cost-centers', new \stdClass(), $user)->rows, fn($r) => $r->_depth === 0);
      $overBudget = filt(map(filt($this->ccTree(), fn($c) => truthy($c->budget ?? null)), fn($c) => obj(['name' => $c->name, 'budget' => $c->budget, 'spent' => num(sum(array_keys($this->ccDescendants($c->id)), fn($id) => sum(filt($exps, fn($e) => ($e->costCenterId ?? null) === (string)$id), fn($e) => $e->amount)))])), fn($c) => $c->spent >= $c->budget * 0.9);
      $pendingExpenses = filt($D()->expenses, fn($e) => $e->status === 'pending');
      $assigned = filt($D()->assets, fn($a) => $a->status === 'assigned');
      $mini = fn($c) => obj(['id' => $c->id, 'no' => $c->no, 'employeeName' => $c->employeeName, 'balance' => $c->balance]);
      return obj([
        'kpis' => obj([
          'openCount' => count($open), 'outstanding' => num(sum($open, fn($c) => $c->balance)), 'issued' => num(sum($open, fn($c) => $c->received)),
          'monthSpent' => $monthSpent, 'pendingCount' => count($pendingExpenses), 'pendingAmount' => num(sum($pendingExpenses, fn($e) => $e->amount)),
          'assetsAssigned' => count($assigned), 'assetsValue' => num(sum($assigned, fn($a) => orv($a->value ?? null, 0))),
        ]),
        'alerts' => obj([
          'overdue' => map(filt($open, fn($c) => $c->overdue), fn($c) => obj(['id' => $c->id, 'no' => $c->no, 'employeeName' => $c->employeeName, 'balance' => $c->balance, 'dueDate' => $c->dueDate ?? null])),
          'negative' => map(filt($open, fn($c) => $c->balance < 0), $mini),
          'low' => map(filt($open, fn($c) => $c->balance >= 0 && $c->balance <= $S()->lowBalance), $mini),
          'overBudget' => $overBudget,
          'requests' => count(filt($D()->requests, fn($r) => $r->status === 'pending')),
          'pendingTx' => count(filt($D()->tx, fn($t) => $t->status === 'pending')),
          'unacknowledged' => count(filt($D()->assets, fn($a) => $a->status === 'assigned' && !truthy($a->acknowledged ?? null))),
        ]),
        'employees' => $employees, 'costCenters' => $ccRows,
        'recent' => map(array_slice(sortBy($D()->expenses, fn($a, $b) => strcmp($b->createdAt, $a->createdAt)), 0, 8), fn($e) => $this->expenseView($e)),
        'setup' => obj(['costCenters' => count($D()->costCenters), 'employees' => count(filt($D()->users, fn($u) => $u->role === 'employee')), 'custodies' => count($D()->custodies)]),
      ]);
    });

    $this->on('GET', '/api/analytics', function ($user, $p, $q) use ($D) {
      $this->staffOnly($user);
      $from = isDate(g($q, 'from')) ? g($q, 'from') : ''; $to = isDate(g($q, 'to')) ? g($q, 'to') : '';
      $inRange = fn($d) => ($from === '' || strcmp($d, $from) >= 0) && ($to === '' || strcmp($d, $to) <= 0);
      $all = filt($D()->expenses, fn($e) => $e->status !== 'rejected');
      $end = $to !== '' ? $to : $this->today();
      [$y, $m] = array_map('intval', explode('-', substr($end, 0, 7)));
      $months = [];
      for ($i = 0; $i < 12; $i++) { array_unshift($months, sprintf('%d-%02d', $y, $m)); if (--$m < 1) { $m = 12; $y--; } }
      $monthly = map($months, function ($mo) use ($all) { $xs = filt($all, fn($e) => substr($e->date, 0, 7) === $mo); return obj(['month' => $mo, 'spent' => num(sum($xs, fn($e) => $e->amount)), 'count' => count($xs)]); });
      $exps = filt($all, fn($e) => $inRange($e->date));
      $group = function ($keyOf, $nameOf) use ($exps) {
        $out = [];
        foreach ($exps as $e) { $k = orv($keyOf($e), ''); $r = first($out, fn($x) => $x->key === $k); if (!$r) { $r = obj(['key' => $k, 'total' => 0, 'count' => 0]); $out[] = $r; } $r->total = num($r->total + $e->amount); $r->count++; }
        return map(sortBy($out, fn($a, $b) => $b->total <=> $a->total), fn($r) => obj(['name' => $nameOf($r->key), 'total' => $r->total, 'count' => $r->count]));
      };
      $range = obj(['from' => $from, 'to' => $to]);
      $status = [];
      foreach (['approved', 'pending', 'rejected'] as $st) $status[$st] = num(sum(filt($D()->expenses, fn($e) => $e->status === $st && $inRange($e->date)), fn($e) => $e->amount));
      $spent = num(sum($exps, fn($e) => $e->amount));
      $issued = num(sum(filt($D()->tx, fn($t) => $t->status === 'confirmed' && $inRange($t->date) && in_array($t->type, ['issue', 'topup', 'reimburse'], true)), fn($t) => $t->amount));
      return obj([
        'from' => $from, 'to' => $to, 'monthly' => $monthly,
        'totals' => obj(['spent' => $spent, 'count' => count($exps), 'avg' => $exps ? num($spent / count($exps)) : 0, 'vat' => num(sum($exps, fn($e) => orv($e->vat ?? null, 0))), 'issued' => $issued, 'outstanding' => num(sum(filt($D()->custodies, fn($c) => $c->status === 'open'), fn($c) => $this->custodyBalance($c)['balance']))]),
        'status' => obj($status),
        'byCategory' => $group(fn($e) => $e->categoryId ?? null, fn($k) => $this->catName($k)),
        'byEmployee' => $group(fn($e) => $e->employeeId, fn($k) => $this->userName($k)),
        'byCostCenter' => sortBy(map(filt($this->reportData('cost-centers', $range, $user)->rows, fn($r) => $r->_depth === 0 && truthy($r->spent)), fn($r) => obj(['name' => jstrim($r->name), 'total' => $r->spent, 'budget' => $r->budget])), fn($a, $b) => $b->total <=> $a->total),
        'bySource' => map(filt($this->reportData('sources', $range, $user)->rows, fn($r) => truthy($r->count)), fn($r) => obj(['name' => $r->name, 'out' => $r->out, 'back' => $r->back, 'net' => $r->net])),
      ]);
    });

    $this->on('GET', '/api/home', fn($user) => obj([
      'totals' => obj($this->employeeTotals($user->id)),
      'custodies' => map(filt($D()->custodies, fn($c) => $c->employeeId === $user->id && $c->status === 'open'), fn($c) => $this->custodyView($c)),
      'recent' => array_slice($this->filterExpenses(new \stdClass(), $user), 0, 10),
      'assets' => filt($D()->assets, fn($a) => ($a->holderId ?? null) === $user->id && $a->status === 'assigned'),
      'requests' => array_reverse(array_slice(filt($D()->requests, fn($r) => $r->employeeId === $user->id), -5)),
    ]));

    // ----- العهد النقدية -----
    $this->on('GET', '/api/custodies', function ($user, $p, $q) use ($D) {
      $list = $D()->custodies;
      if (!$this->isStaff($user)) $list = filt($list, fn($c) => $c->employeeId === $user->id);
      else if (truthy(g($q, 'employeeId'))) $list = filt($list, fn($c) => $c->employeeId === g($q, 'employeeId'));
      if (truthy(g($q, 'status'))) $list = filt($list, fn($c) => $c->status === g($q, 'status'));
      if (truthy(g($q, 'kind'))) $list = filt($list, fn($c) => $c->kind === g($q, 'kind'));
      $out = map(sortBy($list, fn($a, $b) => strcmp($b->createdAt, $a->createdAt)), fn($c) => $this->custodyView($c));
      if (truthy(g($q, 'q'))) { $s = lower(jsstr(g($q, 'q'))); $out = filt($out, fn($c) => some([$c->no, $c->purpose, $c->employeeName], fn($v) => str_contains(lower(jsstr($v)), $s))); }
      if (g($q, 'flag') === 'overdue') $out = filt($out, fn($c) => $c->overdue);
      return $out;
    });
    $this->on('GET', '/api/custodies/:id', function ($user, $p) use ($D) {
      $c = $this->find('custodies', $p['id'], 'العهدة');
      $this->canAccessCustody($user, $c);
      return obj([
        'custody' => $this->custodyView($c),
        'tx' => map(sortBy(filt($D()->tx, fn($t) => $t->custodyId === $c->id), fn($a, $b) => strcmp($a->date . $a->createdAt, $b->date . $b->createdAt)), fn($t) => ext($t, ['typeName' => TX_TYPES[$t->type]['label'], 'sign' => TX_TYPES[$t->type]['sign'], 'createdByName' => $this->userName($t->createdBy ?? null), 'sourceName' => $this->srcName($t->sourceId ?? null)])),
        'expenses' => $this->filterExpenses(obj(['custodyId' => $c->id]), $this->isStaff($user) ? $user : ext($user, ['role' => 'employee'])),
        'settlements' => sortBy(filt($D()->settlements, fn($s) => $s->custodyId === $c->id), fn($a, $b) => strcmp($b->createdAt, $a->createdAt)),
      ]);
    });
    $this->on('POST', '/api/custodies', function ($user, $p, $q, $b) { $this->staffOnly($user); return $this->custodyView($this->createCustody($user, $b)); });
    $this->on('PUT', '/api/custodies/:id', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      $c = $this->find('custodies', $p['id'], 'العهدة');
      if (has($b, 'purpose')) $c->purpose = $this->text($b->purpose, 'الغرض');
      if (has($b, 'costCenterId')) $c->costCenterId = orv($b->costCenterId, null);
      if (has($b, 'dueDate')) $c->dueDate = orv($b->dueDate, null);
      if (has($b, 'notes')) $c->notes = $this->opt($b->notes);
      // تصحيحات مدير النظام: المبلغ والموظف والتاريخ والنوع
      $changes = [];
      if ($user->role === 'admin') {
        $issue = fn() => first($D()->tx, fn($x) => $x->custodyId === $c->id && $x->type === 'issue');
        if (has($b, 'amount') && $b->amount !== '') {
          $t = $issue();
          $amount = $this->money($b->amount, 'مبلغ العهدة');
          if ($t && $t->amount != $amount) { $changes[] = 'المبلغ ' . jsstr($t->amount) . ' ← ' . jsstr($amount); $t->amount = $amount; }
          else if (!$t) { $this->addTx($user, $c, 'issue', $amount, ['date' => $c->issueDate, 'note' => 'صرف العهدة']); $changes[] = 'المبلغ ' . jsstr($amount); }
        }
        if (truthy(g($b, 'employeeId')) && $b->employeeId !== $c->employeeId) {
          $emp = first($D()->users, fn($u) => $u->id === $b->employeeId) ?? fail(400, 'الموظف غير موجود');
          $changes[] = 'الموظف ' . $this->userName($c->employeeId) . ' ← ' . $emp->name;
          $c->employeeId = $emp->id;
          foreach (array_merge($D()->tx, $D()->expenses, $D()->settlements) as $x) if (($x->custodyId ?? null) === $c->id) $x->employeeId = $emp->id;
        }
        if (isDate(g($b, 'issueDate')) && $b->issueDate !== $c->issueDate) {
          $changes[] = "تاريخ الصرف {$c->issueDate} ← {$b->issueDate}";
          $t = $issue();
          if ($t && $t->date === $c->issueDate) $t->date = $b->issueDate;
          $c->issueDate = $b->issueDate;
        }
        $kind = g($b, 'kind');
        if (truthy($kind) && isset(KINDS[$kind]) && $kind !== $c->kind) { $changes[] = 'النوع ' . KINDS[$c->kind] . ' ← ' . KINDS[$kind]; $c->kind = $kind; if ($kind === 'permanent') $c->dueDate = null; }
        if (has($b, 'sourceId')) {
          $t = $issue();
          $src = truthy($b->sourceId) ? $this->find('fundSources', $b->sourceId, 'مصدر المبلغ')->id : null;
          if ($t && orv($t->sourceId ?? null, null) !== $src) { $changes[] = 'المصدر ' . orv($this->srcName($t->sourceId ?? null), 'غير محدد') . ' ← ' . orv($this->srcName($src), 'غير محدد'); $t->sourceId = $src; }
        }
      }
      $this->log($user, $changes ? 'تصحيح عهدة' : 'تعديل عهدة', $c->no . ($changes ? ' — ' . implode('، ', $changes) : ''), 'custody', $c->id);
      return $this->custodyView($c);
    });
    $this->on('POST', '/api/custodies/:id/tx', function ($user, $p, $q, $b) use ($D) {
      $c = $this->find('custodies', $p['id'], 'العهدة');
      $this->canAccessCustody($user, $c);
      if ($c->status !== 'open') fail(400, 'العهدة مغلقة');
      $amount = $this->money(g($b, 'amount'));
      $amt = jsstr($amount);
      $staff = $this->isStaff($user);
      $type = g($b, 'type');
      if (!$staff && $type !== 'return') fail(403, 'يمكنك فقط تسجيل رد مبلغ نقدي');
      $bx = (array)$b;
      if ($type === 'topup') {
        $this->addTx($user, $c, 'topup', $amount, array_merge($bx, ['sourceId' => $this->sourceOf(g($b, 'sourceId'))]));
        $this->notify($c->employeeId, "تم تعزيز عهدتك {$c->no} بمبلغ {$amt}", '#/custody/' . $c->id);
        $this->log($user, 'تعزيز عهدة', "{$c->no} بمبلغ {$amt}", 'custody', $c->id);
      } else if ($type === 'return') {
        $t = $this->addTx($user, $c, 'return', $amount, array_merge($bx, ['status' => $staff ? 'confirmed' : 'pending', 'sourceId' => $staff ? $this->sourceOf(g($b, 'sourceId')) : null]));
        if (!$staff) $this->notify($this->staffIds(), "{$user->name} سجل رد مبلغ {$amt} من العهدة {$c->no} — بانتظار تأكيد الاستلام", '#/custody/' . $c->id);
        $this->log($user, 'رد نقدي', "{$c->no} بمبلغ {$amt}" . ($staff ? '' : ' (بانتظار التأكيد)'), 'tx', $t->id);
      } else if ($type === 'reimburse') {
        $this->addTx($user, $c, 'reimburse', $amount, array_merge($bx, ['sourceId' => $this->sourceOf(g($b, 'sourceId'))]));
        $this->notify($c->employeeId, "تم صرف فرق بمبلغ {$amt} على العهدة {$c->no}", '#/custody/' . $c->id);
        $this->log($user, 'صرف فرق', "{$c->no} بمبلغ {$amt}", 'custody', $c->id);
      } else if ($type === 'transfer') {
        $to = first($D()->users, fn($u) => $u->id === g($b, 'toEmployeeId') && ($u->active ?? null) !== false) ?? fail(400, 'اختر الموظف المحوَّل إليه');
        if ($to->id === $c->employeeId) fail(400, 'لا يمكن التحويل لنفس الموظف');
        if ($amount > $this->custodyBalance($c)['balance']) fail(400, 'المبلغ أكبر من رصيد العهدة');
        $target = truthy(g($b, 'toCustodyId')) ? $this->find('custodies', g($b, 'toCustodyId'), 'العهدة المستلمة') : null;
        if (!$target) $target = $this->createCustodyShell($user, $to, $c, $amount, $b);
        else if ($target->employeeId !== $to->id || $target->status !== 'open') fail(400, 'العهدة المستلمة غير صالحة');
        $note = g($b, 'note');
        $out = $this->addTx($user, $c, 'transfer_out', $amount, array_merge($bx, ['note' => "تحويل إلى {$to->name} ({$target->no})" . (truthy($note) ? ' — ' . jsstr($note) : '')]));
        $inn = $this->addTx($user, $target, 'transfer_in', $amount, array_merge($bx, ['note' => 'تحويل من ' . $this->userName($c->employeeId) . " ({$c->no})", 'relatedId' => $out->id]));
        $out->relatedId = $inn->id;
        $this->notify([$c->employeeId, $to->id], "تحويل {$amt} من العهدة {$c->no} إلى {$to->name} ({$target->no})", '#/custody/' . $target->id);
        $this->log($user, 'تحويل عهدة', "{$amt} من {$c->no} إلى {$target->no}", 'custody', $c->id);
      } else fail(400, 'نوع حركة غير صالح');
      return $this->custodyView($c);
    });
    $this->on('POST', '/api/tx/:id/decide', function ($user, $p, $q, $b) {
      $this->staffOnly($user);
      $t = $this->find('tx', $p['id'], 'الحركة');
      if ($t->status !== 'pending') fail(400, 'تمت معالجة الحركة مسبقاً');
      $approve = truthy(g($b, 'approve'));
      if ($approve) $t->sourceId = $this->sourceOf(g($b, 'sourceId'));
      $t->status = $approve ? 'confirmed' : 'rejected';
      $c = $this->find('custodies', $t->custodyId);
      $this->notify($t->employeeId, ($approve ? 'تم تأكيد' : 'تم رفض') . ' استلام المبلغ المردود ' . jsstr($t->amount) . " من العهدة {$c->no}", '#/custody/' . $c->id);
      $this->log($user, $approve ? 'تأكيد رد نقدي' : 'رفض رد نقدي', "{$c->no} بمبلغ " . jsstr($t->amount), 'tx', $t->id);
      return obj(['ok' => true]);
    });

    // التسوية: اعتماد المصروفات المعلقة وإقفالها في سند تسوية، مع إغلاق العهدة أو تعويضها
    $this->on('POST', '/api/custodies/:id/settle', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      $c = $this->find('custodies', $p['id'], 'العهدة');
      if ($c->status !== 'open') fail(400, 'العهدة مغلقة');
      $close = truthy(g($b, 'close'));
      $bal0 = $this->custodyBalance($c);
      if ($bal0['pendingCount'] && $close) fail(400, "يوجد {$bal0['pendingCount']} مصروف بانتظار الاعتماد — اعتمدها أو ارفضها قبل إغلاق العهدة");
      if ($bal0['pendingTx'] && $close) fail(400, 'يوجد رد نقدي بانتظار التأكيد');
      $exps = filt($D()->expenses, fn($e) => $e->custodyId === $c->id && $e->status === 'approved' && !truthy($e->settlementId ?? null));
      $settleSource = truthy(g($b, 'sourceId')) ? $this->sourceOf(g($b, 'sourceId')) : null;
      $total = num(sum($exps, fn($e) => $e->amount));
      if (!$exps && !$close) fail(400, 'لا توجد مصروفات معتمدة غير مسواة');
      // التحقق من المصدر قبل أي تعديل على البيانات
      if ($close && !$settleSource && $this->custodyBalance($c)['balance'] != 0) $this->sourceOf(null);
      if (!$close && truthy(g($b, 'replenish')) && !$settleSource) $this->sourceOf(null);
      $s = obj(['id' => $this->env->uid(), 'no' => $this->nextNo('ST'), 'custodyId' => $c->id, 'employeeId' => $c->employeeId, 'date' => $this->dateOr(g($b, 'date')), 'expenseIds' => map($exps, fn($e) => $e->id), 'total' => $total, 'returned' => 0, 'reimbursed' => 0, 'replenished' => 0, 'closed' => $close, 'note' => $this->opt(g($b, 'note')), 'createdBy' => $user->id, 'createdAt' => $this->env->now()]);
      foreach ($exps as $e) $e->settlementId = $s->id;
      if ($close) {
        $bal = $this->custodyBalance($c)['balance'];
        if ($bal > 0) { $this->addTx($user, $c, 'return', $bal, ['date' => $s->date, 'method' => g($b, 'method'), 'note' => "رد المتبقي عند التسوية {$s->no}", 'sourceId' => $settleSource, 'settlementId' => $s->id]); $s->returned = $bal; }
        if ($bal < 0) { $this->addTx($user, $c, 'reimburse', -$bal, ['date' => $s->date, 'method' => g($b, 'method'), 'note' => "صرف الفرق للموظف عند التسوية {$s->no}", 'sourceId' => $settleSource, 'settlementId' => $s->id]); $s->reimbursed = num(-$bal); }
        $c->status = 'closed'; $c->closedAt = $this->env->now();
      } else if (truthy(g($b, 'replenish')) && $total > 0) {
        $this->addTx($user, $c, 'topup', $total, ['date' => $s->date, 'method' => g($b, 'method'), 'note' => "تعويض العهدة المستديمة — تسوية {$s->no}", 'sourceId' => $settleSource, 'settlementId' => $s->id]);
        $s->replenished = $total;
      }
      $D()->settlements[] = $s;
      $this->notify($c->employeeId, "تمت تسوية العهدة {$c->no} ({$s->no}) بإجمالي مصروفات " . jsstr($total) . ($s->closed ? ' وإغلاقها' : '') . (truthy($s->replenished) ? ' وتعويضها' : ''), '#/custody/' . $c->id);
      $this->log($user, 'تسوية عهدة', "{$s->no} على {$c->no} بإجمالي " . jsstr($total) . ($s->closed ? ' — إغلاق' : ''), 'settlement', $s->id);
      return obj(['settlement' => $s, 'custody' => $this->custodyView($c)]);
    });
    $this->on('GET', '/api/settlements/:id', function ($user, $p) use ($D) {
      $s = $this->find('settlements', $p['id'], 'التسوية');
      $c = $this->find('custodies', $s->custodyId);
      $this->canAccessCustody($user, $c);
      return obj(['settlement' => $s, 'custody' => $this->custodyView($c), 'expenses' => map(filt($D()->expenses, fn($e) => in_array($e->id, $s->expenseIds, true)), fn($e) => $this->expenseView($e))]);
    });
    $this->on('POST', '/api/custodies/:id/reopen', function ($user, $p) {
      $this->adminOnly($user);
      $c = $this->find('custodies', $p['id'], 'العهدة');
      $c->status = 'open'; $c->closedAt = null;
      $this->log($user, 'إعادة فتح عهدة', $c->no, 'custody', $c->id);
      return $this->custodyView($c);
    });

    // ----- المصروفات -----
    $this->on('GET', '/api/expenses', fn($user, $p, $q) => $this->filterExpenses($q, $user));
    $this->on('GET', '/api/expenses/:id', function ($user, $p) {
      $e = $this->find('expenses', $p['id'], 'المصروف');
      if (!$this->isStaff($user) && $e->employeeId !== $user->id) fail(403, 'غير مسموح');
      return $this->expenseView($e);
    });
    $this->on('POST', '/api/expenses', function ($user, $p, $q, $b) use ($D, $S) {
      $staff = $this->isStaff($user);
      $c = $this->find('custodies', g($b, 'custodyId'), 'العهدة');
      if (!$staff && $c->employeeId !== $user->id) fail(403, 'هذه العهدة ليست باسمك');
      if ($c->status !== 'open') fail(400, 'العهدة مغلقة — لا يمكن إضافة مصروفات عليها');
      $cat = first($D()->categories, fn($x) => $x->id === g($b, 'categoryId') && ($x->active ?? null) !== false) ?? fail(400, 'اختر بند المصروف');
      $ccId = orv(g($b, 'costCenterId'), $c->costCenterId ?? null);
      if (!truthy($ccId)) fail(400, 'اختر مركز التكلفة الذي يتبعه المصروف');
      $cc = $this->find('costCenters', $ccId, 'مركز التكلفة');
      if (($cc->active ?? null) === false) fail(400, 'مركز التكلفة مغلق');
      $amount = $this->money(g($b, 'amount'));
      $attachments = $this->saveAttachments(g($b, 'attachments'));
      $req = $S()->receiptRequiredAbove;
      if (truthy($req) && $amount > $req && !$attachments) fail(400, 'يجب إرفاق صورة الفاتورة للمصروفات التي تزيد عن ' . jsstr($req));
      $vatIncluded = truthy(g($b, 'vatIncluded')) && ($cat->vatApplicable ?? null) !== false;
      $time = g($b, 'time');
      $e = obj([
        'id' => $this->env->uid(), 'no' => $this->nextNo('EX'), 'custodyId' => $c->id, 'employeeId' => $c->employeeId, 'costCenterId' => $cc->id, 'categoryId' => $cat->id,
        'date' => $this->dateOr(g($b, 'date')), 'time' => is_string($time) && preg_match('/^\d{2}:\d{2}$/D', $time) ? $time : substr($this->env->now(), 11, 5),
        'description' => $this->text(g($b, 'description'), 'البيان'), 'vendor' => $this->opt(g($b, 'vendor')), 'vendorVat' => $this->opt(g($b, 'vendorVat')), 'invoiceNo' => $this->opt(g($b, 'invoiceNo')),
        'amount' => $amount, 'vatIncluded' => $vatIncluded, 'vat' => $this->computeVat($amount, $vatIncluded), 'attachments' => $attachments, 'paymentMethod' => orv($this->opt(g($b, 'paymentMethod')), 'نقداً'),
        'status' => $staff && g($b, 'autoApprove') !== false ? 'approved' : 'pending', 'reviewNote' => '', 'reviewedBy' => $staff ? $user->id : null,
        'viaReminder' => truthy(g($b, 'viaReminder')), 'settlementId' => null, 'createdBy' => $user->id, 'createdAt' => $this->env->now(),
      ]);
      $D()->expenses[] = $e;
      if (truthy(g($b, 'viaReminder'))) $D()->checkins[] = obj(['id' => $this->env->uid(), 'employeeId' => $user->id, 'at' => $this->env->now(), 'answer' => 'yes', 'expenseId' => $e->id]);
      if (!$staff) $this->notify($this->staffIds(), "{$user->name} سجل مصروف {$e->no} بمبلغ " . jsstr($amount) . " — {$e->description}", '#/expense/' . $e->id);
      $this->log($user, 'تسجيل مصروف', "{$e->no} بمبلغ " . jsstr($amount) . " على {$c->no}", 'expense', $e->id);
      return $this->expenseView($e);
    });
    $this->on('PUT', '/api/expenses/:id', function ($user, $p, $q, $b) use ($D) {
      $e = $this->find('expenses', $p['id'], 'المصروف');
      $staff = $this->isStaff($user);
      if (truthy($e->settlementId ?? null) && $user->role !== 'admin') fail(400, 'المصروف داخل تسوية — لا يمكن تعديله');
      $before = ['amount' => $e->amount, 'date' => $e->date, 'categoryId' => $e->categoryId, 'costCenterId' => $e->costCenterId];
      if (!$staff && ($e->employeeId !== $user->id || $e->status === 'approved')) fail(403, 'لا يمكن تعديل مصروف معتمد');
      if (truthy(g($b, 'categoryId'))) $e->categoryId = (first($D()->categories, fn($x) => $x->id === g($b, 'categoryId')) ?? fail(400, 'بند غير صالح'))->id;
      if (truthy(g($b, 'costCenterId'))) $e->costCenterId = $this->find('costCenters', g($b, 'costCenterId'), 'مركز التكلفة')->id;
      if (has($b, 'amount')) $e->amount = $this->money($b->amount);
      foreach (['description', 'vendor', 'vendorVat', 'invoiceNo', 'paymentMethod'] as $k) if (has($b, $k)) $e->$k = $this->opt($b->$k);
      if (!truthy($e->description ?? null)) fail(400, 'حقل «البيان» مطلوب');
      if (truthy(g($b, 'date'))) $e->date = $this->dateOr($b->date);
      if (has($b, 'vatIncluded')) $e->vatIncluded = truthy($b->vatIncluded);
      $e->vat = $this->computeVat($e->amount, $e->vatIncluded ?? null);
      if (is_array(g($b, 'attachments'))) $e->attachments = $this->saveAttachments($b->attachments);
      if (!$staff && $e->status === 'rejected') { $e->status = 'pending'; $this->notify($this->staffIds(), "{$user->name} عدّل المصروف المرفوض {$e->no} وأعاد إرساله", '#/expense/' . $e->id); }
      if (truthy($e->settlementId ?? null)) $this->refreshSettlement($e->settlementId);
      $diff = [];
      if ($before['amount'] != $e->amount) $diff[] = 'المبلغ ' . jsstr($before['amount']) . ' ← ' . jsstr($e->amount);
      if ($before['date'] !== $e->date) $diff[] = "التاريخ {$before['date']} ← {$e->date}";
      if ($before['categoryId'] !== $e->categoryId) $diff[] = 'البند ' . $this->catName($before['categoryId']) . ' ← ' . $this->catName($e->categoryId);
      if ($before['costCenterId'] !== $e->costCenterId) $diff[] = 'المركز ' . $this->ccName($before['costCenterId']) . ' ← ' . $this->ccName($e->costCenterId);
      $this->log($user, 'تعديل مصروف', $e->no . ($diff ? ' — ' . implode('، ', $diff) : ''), 'expense', $e->id);
      return $this->expenseView($e);
    });
    $this->on('POST', '/api/expenses/review', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      $st = g($b, 'status');
      $status = $st === 'approved' ? 'approved' : ($st === 'rejected' ? 'rejected' : ($st === 'pending' ? 'pending' : fail(400, 'حالة غير صالحة')));
      $ids = orv(g($b, 'ids'), []);
      $ids = is_array($ids) ? array_values($ids) : [$ids];
      $n = 0;
      foreach ($ids as $id) {
        $e = first($D()->expenses, fn($x) => $x->id === $id);
        if (!$e || truthy($e->settlementId ?? null)) continue;
        $e->status = $status; $e->reviewedBy = $user->id; $e->reviewedAt = $this->env->now();
        if (has($b, 'note')) $e->reviewNote = $this->opt($b->note);
        $this->notify($e->employeeId, ($status === 'approved' ? '✅ تم اعتماد' : ($status === 'rejected' ? '❌ تم رفض' : 'أعيد للمراجعة')) . " المصروف {$e->no} (" . jsstr($e->amount) . ')' . (truthy($e->reviewNote ?? null) ? ' — ' . $e->reviewNote : ''), '#/expense/' . $e->id);
        $n++;
      }
      $this->log($user, $status === 'approved' ? 'اعتماد مصروفات' : 'رفض مصروفات', "{$n} مصروف", 'expense', $ids[0] ?? null);
      return obj(['updated' => $n]);
    });
    $this->on('DELETE', '/api/expenses/:id', function ($user, $p) use ($D) {
      $e = $this->find('expenses', $p['id'], 'المصروف');
      if (truthy($e->settlementId ?? null) && $user->role !== 'admin') fail(400, 'المصروف داخل تسوية — لا يمكن حذفه');
      if (!$this->isStaff($user) && ($e->employeeId !== $user->id || $e->status === 'approved')) fail(403, 'لا يمكن حذف هذا المصروف');
      $D()->expenses = filt($D()->expenses, fn($x) => $x->id !== $e->id);
      if (truthy($e->settlementId ?? null)) $this->refreshSettlement($e->settlementId);
      $this->log($user, 'حذف مصروف', "{$e->no} بمبلغ " . jsstr($e->amount), 'expense', $e->id);
      return obj(['ok' => true]);
    });

    // ----- طلبات العهد -----
    $this->on('GET', '/api/requests', function ($user, $p, $q) use ($D) {
      $list = $D()->requests;
      if (!$this->isStaff($user)) $list = filt($list, fn($r) => $r->employeeId === $user->id);
      if (truthy(g($q, 'status'))) $list = filt($list, fn($r) => $r->status === g($q, 'status'));
      return map(sortBy($list, fn($a, $b) => strcmp($b->createdAt, $a->createdAt)), fn($r) => ext($r, ['employeeName' => $this->userName($r->employeeId), 'costCenterName' => $this->ccName($r->costCenterId ?? null)]));
    });
    $this->on('POST', '/api/requests', function ($user, $p, $q, $b) use ($D) {
      $type = g($b, 'type') === 'asset' ? 'asset' : 'cash';
      // تعميد مباشر: الموظف استلم العهدة فعلاً (من المالك غالباً) ويسجلها بنفسه بدل أن يطلبها
      $direct = truthy(g($b, 'alreadyPaid')) && $type === 'cash';
      if ($direct && !$this->isStaff($user) && !truthy($user->directCustody ?? null)) fail(403, 'غير مسموح لك بتسجيل عهدة مصروفة مباشرة — اطلبها من الإدارة');
      $src = $direct ? $this->sourceOf(g($b, 'sourceId')) : null;
      if ($direct && truthy(g($b, 'costCenterId'))) $this->find('costCenters', g($b, 'costCenterId'), 'مركز التكلفة');
      $kind = g($b, 'kind');
      $r = obj([
        'id' => $this->env->uid(), 'no' => $this->nextNo('RQ'), 'type' => $type, 'employeeId' => $user->id, 'amount' => $type === 'cash' ? $this->money(g($b, 'amount')) : 0, 'kind' => is_string($kind) && isset(KINDS[$kind]) ? $kind : 'temporary',
        'purpose' => $this->text(g($b, 'purpose'), 'الغرض'), 'costCenterId' => orv(g($b, 'costCenterId'), null), 'neededBy' => orv(g($b, 'neededBy'), null), 'status' => 'pending', 'decisionNote' => '', 'createdAt' => $this->env->now(),
      ]);
      if ($direct) {
        $c = $this->createCustody($user, obj(['employeeId' => $user->id, 'kind' => $r->kind, 'amount' => $r->amount, 'purpose' => $r->purpose, 'costCenterId' => $r->costCenterId, 'issueDate' => g($b, 'issueDate'), 'dueDate' => $r->neededBy, 'sourceId' => g($b, 'sourceId'), 'method' => g($b, 'method'), 'ref' => g($b, 'ref'), 'notes' => g($b, 'notes'), 'direct' => true, 'force' => true]));
        foreach (['status' => 'approved', 'direct' => true, 'custodyId' => $c->id, 'decisionNote' => 'تعميد مباشر', 'decidedAt' => $this->env->now()] as $k => $v) $r->$k = $v;
        $D()->requests[] = $r;
        $this->notify($this->staffIds(), "{$user->name} سجل استلام عهدة بتعميد مباشر {$c->no} بمبلغ " . jsstr($r->amount) . ' من ' . orv($this->srcName($src), 'غير محدد') . " — {$r->purpose}", '#/custody/' . $c->id);
        $this->log($user, 'عهدة بتعميد مباشر', "{$r->no} / {$c->no} بمبلغ " . jsstr($r->amount), 'request', $r->id);
        return $r;
      }
      $D()->requests[] = $r;
      $this->notify($this->staffIds(), "{$user->name} طلب " . ($type === 'cash' ? 'عهدة نقدية بمبلغ ' . jsstr($r->amount) : 'عهدة عينية') . " — {$r->purpose}", '#/requests');
      $this->log($user, 'طلب عهدة', "{$r->no} {$r->purpose}", 'request', $r->id);
      return $r;
    });
    $this->on('POST', '/api/requests/:id/decide', function ($user, $p, $q, $b) {
      $this->staffOnly($user);
      $r = $this->find('requests', $p['id'], 'الطلب');
      if ($r->status !== 'pending') fail(400, 'تمت معالجة الطلب مسبقاً');
      $r->decisionNote = $this->opt(g($b, 'note')); $r->decidedBy = $user->id; $r->decidedAt = $this->env->now();
      if (!truthy(g($b, 'approve'))) {
        $r->status = 'rejected';
        $this->notify($r->employeeId, "تم رفض طلبك {$r->no}" . (truthy($r->decisionNote) ? ' — ' . $r->decisionNote : ''), '#/requests');
      } else {
        $r->status = 'approved';
        if ($r->type === 'cash') {
          $c = $this->createCustody($user, obj(['employeeId' => $r->employeeId, 'kind' => $r->kind, 'amount' => orv(g($b, 'amount'), $r->amount), 'purpose' => $r->purpose, 'costCenterId' => orv(g($b, 'costCenterId'), $r->costCenterId ?? null), 'method' => g($b, 'method'), 'dueDate' => orv(g($b, 'dueDate'), $r->neededBy ?? null), 'sourceId' => g($b, 'sourceId'), 'force' => true]));
          $r->custodyId = $c->id;
        } else $this->notify($r->employeeId, "تمت الموافقة على طلبك {$r->no} — سيتم تسليمك العهدة العينية", '#/requests');
      }
      $this->log($user, $r->status === 'approved' ? 'موافقة على طلب' : 'رفض طلب', $r->no, 'request', $r->id);
      return $r;
    });

    // ----- العهد العينية -----
    $this->on('GET', '/api/assets', function ($user, $p, $q) use ($D) {
      $list = $D()->assets;
      if (!$this->isStaff($user)) $list = filt($list, fn($a) => ($a->holderId ?? null) === $user->id);
      else if (truthy(g($q, 'holderId'))) $list = filt($list, fn($a) => ($a->holderId ?? null) === g($q, 'holderId'));
      if (truthy(g($q, 'status'))) $list = filt($list, fn($a) => $a->status === g($q, 'status'));
      $out = map(sortBy($list, fn($a, $b) => strcmp($b->createdAt, $a->createdAt)), fn($a) => $this->assetView($a));
      if (truthy(g($q, 'q'))) { $s = lower(jsstr(g($q, 'q'))); $out = filt($out, fn($a) => some([$a->no, $a->name, $a->serial ?? null, $a->holderName, $a->category], fn($v) => str_contains(lower(jsstr(orv($v, ''))), $s))); }
      return $out;
    });
    $this->on('GET', '/api/assets/:id', function ($user, $p) use ($D) {
      $a = $this->find('assets', $p['id'], 'الأصل');
      if (!$this->isStaff($user) && ($a->holderId ?? null) !== $user->id) fail(403, 'غير مسموح');
      return obj(['asset' => $this->assetView($a), 'moves' => map(sortBy(filt($D()->assetMoves, fn($m) => $m->assetId === $a->id), fn($x, $y) => strcmp($y->createdAt, $x->createdAt)), fn($m) => ext($m, ['typeName' => ASSET_MOVES[$m->type] ?? null, 'fromName' => truthy($m->fromId ?? null) ? $this->userName($m->fromId) : '', 'toName' => truthy($m->toId ?? null) ? $this->userName($m->toId) : '', 'byName' => $this->userName($m->createdBy ?? null)]))]);
    });
    $this->on('POST', '/api/assets', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      $a = obj([
        'id' => $this->env->uid(), 'no' => $this->nextNo('AS'), 'name' => $this->text(g($b, 'name'), 'اسم الأصل'), 'category' => orv($this->opt(g($b, 'category')), 'أخرى'), 'serial' => $this->opt(g($b, 'serial')), 'model' => $this->opt(g($b, 'model')),
        'value' => num(g($b, 'value')), 'purchaseDate' => orv(g($b, 'purchaseDate'), null), 'costCenterId' => orv(g($b, 'costCenterId'), null), 'condition' => orv($this->opt(g($b, 'condition')), 'جديد'),
        'status' => 'available', 'holderId' => null, 'acknowledged' => false, 'photos' => $this->saveAttachments(g($b, 'photos')), 'notes' => $this->opt(g($b, 'notes')), 'createdAt' => $this->env->now(),
      ]);
      $D()->assets[] = $a;
      $this->log($user, 'إضافة أصل', "{$a->no} {$a->name}", 'asset', $a->id);
      if (truthy(g($b, 'assignTo'))) $this->moveAsset($user, $a, obj(['type' => 'assign', 'toId' => $b->assignTo, 'condition' => $a->condition]));
      return $this->assetView($a);
    });
    $this->on('PUT', '/api/assets/:id', function ($user, $p, $q, $b) {
      $this->staffOnly($user);
      $a = $this->find('assets', $p['id'], 'الأصل');
      foreach (['name', 'category', 'serial', 'model', 'condition', 'notes'] as $k) if (has($b, $k)) $a->$k = $this->opt($b->$k);
      if (!truthy($a->name ?? null)) fail(400, 'اسم الأصل مطلوب');
      if (has($b, 'value')) $a->value = num($b->value);
      if (has($b, 'purchaseDate')) $a->purchaseDate = orv($b->purchaseDate, null);
      if (has($b, 'costCenterId')) $a->costCenterId = orv($b->costCenterId, null);
      if (is_array(g($b, 'photos'))) $a->photos = $this->saveAttachments($b->photos);
      $this->log($user, 'تعديل أصل', $a->no, 'asset', $a->id);
      return $this->assetView($a);
    });
    $this->on('POST', '/api/assets/:id/move', function ($user, $p, $q, $b) { $this->staffOnly($user); $a = $this->find('assets', $p['id'], 'الأصل'); $this->moveAsset($user, $a, $b); return $this->assetView($a); });
    $this->on('POST', '/api/assets/:id/ack', function ($user, $p) {
      $a = $this->find('assets', $p['id'], 'الأصل');
      if (($a->holderId ?? null) !== $user->id) fail(403, 'هذا الأصل ليس بعهدتك');
      $a->acknowledged = true; $a->acknowledgedAt = $this->env->now();
      $this->notify($this->staffIds(), "{$user->name} أقر باستلام {$a->name} ({$a->no})", '#/asset/' . $a->id);
      $this->log($user, 'إقرار استلام أصل', $a->no, 'asset', $a->id);
      return $this->assetView($a);
    });

    // ----- مراكز التكلفة والبنود -----
    $this->on('POST', '/api/cost-centers', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      if (truthy(g($b, 'parentId'))) $this->find('costCenters', $b->parentId, 'المركز الرئيسي');
      $type = g($b, 'type');
      $c = obj(['id' => $this->env->uid(), 'code' => $this->opt(g($b, 'code')), 'name' => $this->text(g($b, 'name'), 'اسم مركز التكلفة'), 'type' => is_string($type) && isset(CC_TYPES[$type]) ? $type : 'project', 'parentId' => orv(g($b, 'parentId'), null), 'budget' => num(g($b, 'budget')), 'managerId' => orv(g($b, 'managerId'), null), 'active' => true, 'notes' => $this->opt(g($b, 'notes')), 'createdAt' => $this->env->now()]);
      if ($c->code !== '' && some($D()->costCenters, fn($x) => ($x->code ?? null) === $c->code)) fail(400, 'رمز مركز التكلفة مستخدم مسبقاً');
      $D()->costCenters[] = $c;
      $this->log($user, 'إضافة مركز تكلفة', "{$c->code} {$c->name}", 'costCenter', $c->id);
      return $c;
    });
    $this->on('PUT', '/api/cost-centers/:id', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      $c = $this->find('costCenters', $p['id'], 'مركز التكلفة');
      if (has($b, 'name')) $c->name = $this->text($b->name, 'الاسم');
      if (has($b, 'code')) { if (truthy($b->code) && some($D()->costCenters, fn($x) => ($x->code ?? null) === $b->code && $x->id !== $c->id)) fail(400, 'الرمز مستخدم'); $c->code = $this->opt($b->code); }
      $type = g($b, 'type');
      if (truthy($type) && is_string($type) && isset(CC_TYPES[$type])) $c->type = $type;
      if (has($b, 'parentId')) { if (truthy($b->parentId) && isset($this->ccDescendants($c->id)[$b->parentId])) fail(400, 'لا يمكن جعل المركز تابعاً لأحد فروعه'); $c->parentId = orv($b->parentId, null); }
      if (has($b, 'budget')) $c->budget = num($b->budget);
      if (has($b, 'managerId')) $c->managerId = orv($b->managerId, null);
      if (has($b, 'active')) $c->active = truthy($b->active);
      if (has($b, 'notes')) $c->notes = $this->opt($b->notes);
      $this->log($user, 'تعديل مركز تكلفة', $c->name, 'costCenter', $c->id);
      return $c;
    });
    $this->on('GET', '/api/cost-centers/:id', function ($user, $p, $q) use ($D) {
      $this->staffOnly($user);
      $c = $this->find('costCenters', $p['id'], 'مركز التكلفة');
      $ids = $this->ccDescendants($c->id);
      $exps = $this->filterExpenses(obj(['costCenterId' => $c->id, 'from' => g($q, 'from'), 'to' => g($q, 'to')]), $user);
      $valid = filt($exps, fn($e) => $e->status !== 'rejected');
      $byCat = [];
      foreach ($valid as $e) $byCat[$e->categoryName] = num(($byCat[$e->categoryName] ?? 0) + $e->amount);
      $byEmp = [];
      foreach ($valid as $e) $byEmp[$e->employeeName] = num(($byEmp[$e->employeeName] ?? 0) + $e->amount);
      $entries = function ($m) { $out = []; foreach ($m as $k => $v) $out[] = [(string)$k, $v]; return sortBy($out, fn($a, $b) => $b[1] <=> $a[1]); };
      return obj([
        'costCenter' => ext($c, ['parentName' => truthy($c->parentId ?? null) ? $this->ccName($c->parentId) : '', 'managerName' => truthy($c->managerId ?? null) ? $this->userName($c->managerId) : '']),
        'children' => filt($this->ccTree(), fn($x) => ($x->parentId ?? null) === $c->id), 'spent' => num(sum($valid, fn($e) => $e->amount)),
        'byCategory' => $entries($byCat), 'byEmployee' => $entries($byEmp),
        'expenses' => array_slice($exps, 0, 100), 'custodies' => map(filt($D()->custodies, fn($x) => isset($x->costCenterId) && isset($ids[$x->costCenterId]) && $x->status === 'open'), fn($x) => $this->custodyView($x)),
        'assets' => map(filt($D()->assets, fn($a) => isset($a->costCenterId) && isset($ids[$a->costCenterId])), fn($a) => $this->assetView($a)),
      ]);
    });
    $this->on('POST', '/api/sources', function ($user, $p, $q, $b) use ($D) {
      $this->staffOnly($user);
      $type = g($b, 'type');
      $x = obj(['id' => $this->env->uid(), 'name' => $this->text(g($b, 'name'), 'اسم المصدر'), 'type' => is_string($type) && isset(SOURCE_TYPES[$type]) ? $type : 'other', 'accountNo' => $this->opt(g($b, 'accountNo')), 'active' => true, 'notes' => $this->opt(g($b, 'notes'))]);
      $D()->fundSources[] = $x;
      $this->log($user, 'إضافة مصدر أموال', $x->name, 'source', $x->id);
      return $x;
    });
    $this->on('PUT', '/api/sources/:id', function ($user, $p, $q, $b) {
      $this->staffOnly($user);
      $x = $this->find('fundSources', $p['id'], 'المصدر');
      if (has($b, 'name')) $x->name = $this->text($b->name, 'اسم المصدر');
      $type = g($b, 'type');
      if (truthy($type) && is_string($type) && isset(SOURCE_TYPES[$type])) $x->type = $type;
      foreach (['accountNo', 'notes'] as $k) if (has($b, $k)) $x->$k = $this->opt($b->$k);
      if (has($b, 'active')) $x->active = truthy($b->active);
      $this->log($user, 'تعديل مصدر أموال', $x->name, 'source', $x->id);
      return $x;
    });
    // الموظف في الموقع يضيف نوع مصروف جديد بنفسه، والإدارة تُبلَّغ لتعطيه رقم حساب
    $this->on('POST', '/api/categories', function ($user, $p, $q, $b) use ($D) {
      $staff = $this->isStaff($user);
      $name = $this->text(g($b, 'name'), 'اسم البند');
      $same = first($D()->categories, fn($x) => lower(jstrim(jsstr($x->name))) === lower($name));
      if ($same) { if (!$staff && ($same->active ?? null) === false) fail(400, 'هذا البند موقوف من الإدارة'); return $same; }
      $c = obj(['id' => $this->env->uid(), 'code' => $staff ? $this->opt(g($b, 'code')) : '', 'name' => $name, 'vatApplicable' => g($b, 'vatApplicable') !== false, 'active' => true]);
      if (!$staff) $c->addedBy = $user->id;
      $D()->categories[] = $c;
      if (!$staff) $this->notify($this->staffIds(), "{$user->name} أضاف نوع مصروف جديد: {$c->name}", '#/categories');
      $this->log($user, 'إضافة بند', $c->name, 'category', $c->id);
      return $c;
    });
    $this->on('PUT', '/api/categories/:id', function ($user, $p, $q, $b) {
      $this->staffOnly($user);
      $c = $this->find('categories', $p['id'], 'البند');
      if (has($b, 'name')) $c->name = $this->text($b->name, 'اسم البند');
      if (has($b, 'code')) $c->code = $this->opt($b->code);
      if (has($b, 'vatApplicable')) $c->vatApplicable = truthy($b->vatApplicable);
      if (has($b, 'active')) $c->active = truthy($b->active);
      return $c;
    });

    // ----- المستخدمون والإعدادات -----
    $this->on('POST', '/api/users', function ($user, $p, $q, $b) use ($D) {
      $this->adminOnly($user);
      $username = lower($this->text(g($b, 'username'), 'اسم المستخدم'));
      if (some($D()->users, fn($u) => $u->username === $username)) fail(400, 'اسم المستخدم مستخدم مسبقاً');
      if (mb_strlen(jsstr(orv(g($b, 'password'), ''))) < 4) fail(400, 'كلمة المرور يجب ألا تقل عن 4 أحرف');
      $role = g($b, 'role');
      $u = obj(array_merge(['id' => $this->env->uid(), 'name' => $this->text(g($b, 'name'), 'الاسم'), 'username' => $username, 'role' => is_string($role) && isset(ROLES[$role]) ? $role : 'employee', 'jobTitle' => $this->opt(g($b, 'jobTitle')), 'phone' => $this->opt(g($b, 'phone')), 'department' => $this->opt(g($b, 'department')), 'custodyLimit' => num(g($b, 'custodyLimit')), 'directCustody' => truthy(g($b, 'directCustody')), 'active' => true, 'createdAt' => $this->env->now()], $this->env->hashPassword(g($b, 'password'))));
      $D()->users[] = $u;
      $this->log($user, 'إضافة مستخدم', "{$u->name} (" . ROLES[$u->role] . ')', 'user', $u->id);
      return $this->publicUser($u);
    });
    $this->on('PUT', '/api/users/:id', function ($user, $p, $q, $b) {
      $this->adminOnly($user);
      $u = $this->find('users', $p['id'], 'المستخدم');
      foreach (['name', 'jobTitle', 'phone', 'department'] as $k) if (has($b, $k)) $u->$k = $this->opt($b->$k);
      if (!truthy($u->name ?? null)) fail(400, 'الاسم مطلوب');
      if (has($b, 'custodyLimit')) $u->custodyLimit = num($b->custodyLimit);
      if (has($b, 'directCustody')) $u->directCustody = truthy($b->directCustody);
      $role = g($b, 'role');
      if (truthy($role) && is_string($role) && isset(ROLES[$role])) { if ($u->id === $user->id && $role !== 'admin') fail(400, 'لا يمكنك تغيير صلاحيتك'); $u->role = $role; }
      if (has($b, 'active')) { if ($u->id === $user->id && !truthy($b->active)) fail(400, 'لا يمكنك إيقاف حسابك'); $u->active = truthy($b->active); }
      if (truthy(g($b, 'password'))) { if (mb_strlen(jsstr($b->password)) < 4) fail(400, 'كلمة المرور قصيرة'); foreach ($this->env->hashPassword($b->password) as $k => $v) $u->$k = $v; }
      $this->log($user, 'تعديل مستخدم', $u->name, 'user', $u->id);
      return $this->publicUser($u);
    });
    $this->on('POST', '/api/password', function ($user, $p, $q, $b) {
      if (!$this->env->verifyPassword($user, orv(g($b, 'oldPassword'), ''))) fail(400, 'كلمة المرور الحالية غير صحيحة');
      if (mb_strlen(jsstr(orv(g($b, 'newPassword'), ''))) < 4) fail(400, 'كلمة المرور الجديدة قصيرة جداً');
      foreach ($this->env->hashPassword($b->newPassword) as $k => $v) $user->$k = $v;
      $this->log($user, 'تغيير كلمة المرور', $user->name, 'user', $user->id);
      return obj(['ok' => true]);
    });
    $this->on('PUT', '/api/settings', function ($user, $p, $q, $b) use ($S) {
      $this->adminOnly($user);
      $s = $S();
      foreach (['companyName', 'vatNumber', 'address', 'currency'] as $k) if (has($b, $k)) $s->$k = $this->opt($b->$k);
      foreach (['workStart', 'workEnd'] as $k) { $v = g($b, $k); if (is_string($v) && preg_match('/^\d{2}:\d{2}$/D', $v)) $s->$k = $v; }
      if (is_array(g($b, 'workDays'))) $s->workDays = filt(map($b->workDays, fn($d) => ($n = jsnum($d)) == floor($n) && is_finite($n) ? (int)$n : $n), fn($d) => $d >= 0 && $d <= 6);
      foreach ([['reminderMinutes', 5, 240], ['agingDays', 1, 365], ['vatRate', 0, 100]] as [$k, $min, $max]) if (has($b, $k) && $b->$k !== '') { $n = jsnum($b->$k); if (is_nan($n) || !$n) $n = 0; $v = max($min, min($max, $n)); $s->$k = $v == floor($v) ? (int)$v : $v; }
      foreach (['lowBalance', 'receiptRequiredAbove'] as $k) if (has($b, $k)) $s->$k = num($b->$k);
      if (has($b, 'remindersEnabled')) $s->remindersEnabled = truthy($b->remindersEnabled);
      $this->log($user, 'تعديل الإعدادات', '', 'settings', null);
      return $s;
    });

    // ----- التنبيهات والإشعارات -----
    $this->on('POST', '/api/checkins', function ($user, $p, $q, $b) use ($D) {
      $D()->checkins[] = obj(['id' => $this->env->uid(), 'employeeId' => $user->id, 'at' => $this->env->now(), 'answer' => g($b, 'answer') === 'yes' ? 'yes' : 'no']);
      if (count($D()->checkins) > 30000) array_splice($D()->checkins, 0, count($D()->checkins) - 30000);
      return obj(['ok' => true]);
    });
    $this->on('GET', '/api/notifications', fn($user) => array_slice(sortBy(filt($D()->notifications, fn($n) => $n->userId === $user->id), fn($a, $b) => strcmp($b->at, $a->at)), 0, 100));
    $this->on('POST', '/api/notifications/read', function ($user) use ($D) { foreach ($D()->notifications as $n) if ($n->userId === $user->id) $n->read = true; return obj(['ok' => true]); });

    $this->on('GET', '/api/reports/:name', fn($user, $p, $q) => $this->reportData($p['name'], $q, $user));
    $this->on('GET', '/api/audit', function ($user, $p, $q) use ($D) {
      $this->staffOnly($user);
      $list = array_reverse($D()->audit);
      if (truthy(g($q, 'q'))) { $s = lower(jsstr(g($q, 'q'))); $list = filt($list, fn($a) => some([$a->action ?? null, $a->summary ?? null, $a->userName ?? null], fn($v) => str_contains(lower(jsstr(orv($v, ''))), $s))); }
      return array_slice($list, 0, 300);
    });
    $this->on('GET', '/api/backup', function ($user) use ($D) { $this->adminOnly($user); $rest = clone $D(); unset($rest->sessions); return $rest; });

    // ----- تصحيح الأخطاء: تعديل وحذف لمدير النظام فقط -----
    $this->on('PUT', '/api/tx/:id', function ($user, $p, $q, $b) use ($D) {
      $this->adminOnly($user);
      $t = $this->find('tx', $p['id'], 'الحركة');
      $c = $this->find('custodies', $t->custodyId, 'العهدة');
      $diff = [];
      $pair = truthy($t->relatedId ?? null) ? first($D()->tx, fn($x) => $x->id === $t->relatedId) : null;
      if (has($b, 'amount') && $b->amount !== '') {
        $amount = $this->money($b->amount);
        if ($amount != $t->amount) { $diff[] = 'المبلغ ' . jsstr($t->amount) . ' ← ' . jsstr($amount); $t->amount = $amount; if ($pair) $pair->amount = $amount; }
      }
      if (isDate(g($b, 'date')) && $b->date !== $t->date) { $diff[] = "التاريخ {$t->date} ← {$b->date}"; $t->date = $b->date; if ($pair) $pair->date = $b->date; if ($t->type === 'issue' && truthy($c->issueDate ?? null)) $c->issueDate = $b->date; }
      if (has($b, 'sourceId')) { $src = truthy($b->sourceId) ? $this->find('fundSources', $b->sourceId, 'مصدر المبلغ')->id : null; if (orv($t->sourceId ?? null, null) !== $src) { $diff[] = 'المصدر ' . orv($this->srcName($t->sourceId ?? null), 'غير محدد') . ' ← ' . orv($this->srcName($src), 'غير محدد'); $t->sourceId = $src; } }
      foreach (['method', 'ref', 'note'] as $k) if (has($b, $k)) $t->$k = $this->opt($b->$k);
      $s = $this->settlementOfTx($t);
      if ($s) { if ($t->type === 'return') $s->returned = $t->amount; if ($t->type === 'reimburse') $s->reimbursed = $t->amount; if ($t->type === 'topup') $s->replenished = $t->amount; }
      $this->log($user, 'تصحيح حركة عهدة', TX_TYPES[$t->type]['label'] . " على {$c->no}" . ($diff ? ' — ' . implode('، ', $diff) : ''), 'custody', $c->id);
      return $this->custodyView($c);
    });
    $this->on('DELETE', '/api/tx/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $t = $this->find('tx', $p['id'], 'الحركة');
      $c = $this->find('custodies', $t->custodyId, 'العهدة');
      if ($t->type === 'issue' && count(filt($D()->tx, fn($x) => $x->custodyId === $c->id && $x->type === 'issue')) === 1) fail(400, 'هذه حركة صرف العهدة الأساسية — عدّل مبلغها، أو احذف العهدة كاملة');
      $s = $this->settlementOfTx($t);
      if ($s) { if ($t->type === 'return') $s->returned = 0; if ($t->type === 'reimburse') $s->reimbursed = 0; if ($t->type === 'topup') $s->replenished = 0; }
      $this->removeTx([$t->id]);
      $this->log($user, 'حذف حركة عهدة', TX_TYPES[$t->type]['label'] . ' بمبلغ ' . jsstr($t->amount) . " على {$c->no}" . (truthy($t->relatedId ?? null) ? ' (مع الحركة المقابلة)' : ''), 'custody', $c->id);
      return $this->custodyView($c);
    });
    $this->on('DELETE', '/api/custodies/:id', function ($user, $p) {
      $this->adminOnly($user);
      $c = $this->find('custodies', $p['id'], 'العهدة');
      $this->removeCustody($user, $c);
      return obj(['ok' => true]);
    });
    // التراجع عن تسوية: تعود المصروفات غير مسواة، وتحذف حركات الرد/الفرق/التعويض، وتفتح العهدة إن كانت أغلقت بها
    $this->on('DELETE', '/api/settlements/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $s = $this->find('settlements', $p['id'], 'التسوية');
      $c = first($D()->custodies, fn($x) => $x->id === $s->custodyId);
      foreach ($D()->expenses as $e) if (($e->settlementId ?? null) === $s->id) $e->settlementId = null;
      $this->removeTx(map($this->settlementTx($s), fn($t) => $t->id));
      $D()->settlements = filt($D()->settlements, fn($x) => $x->id !== $s->id);
      if ($c && truthy($s->closed ?? null)) { $c->status = 'open'; $c->closedAt = null; }
      $this->log($user, 'التراجع عن تسوية', $s->no . ($c ? " على {$c->no}" : '') . ' بإجمالي ' . jsstr($s->total), 'settlement', $s->id);
      return $c ? $this->custodyView($c) : obj(['ok' => true]);
    });
    $this->on('DELETE', '/api/requests/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $r = $this->find('requests', $p['id'], 'الطلب');
      $D()->requests = filt($D()->requests, fn($x) => $x->id !== $r->id);
      $this->log($user, 'حذف طلب', "{$r->no} — {$r->purpose}" . (truthy($r->custodyId ?? null) ? ' (العهدة المرتبطة باقية)' : ''), 'request', $r->id);
      return obj(['ok' => true]);
    });
    $this->on('DELETE', '/api/assets/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $a = $this->find('assets', $p['id'], 'الأصل');
      $D()->assets = filt($D()->assets, fn($x) => $x->id !== $a->id);
      $D()->assetMoves = filt($D()->assetMoves, fn($m) => $m->assetId !== $a->id);
      $this->log($user, 'حذف أصل', "{$a->no} {$a->name}", 'asset', $a->id);
      return obj(['ok' => true]);
    });
    // حذف مستخدم: مسموح إن لم تكن عليه عهد؛ ومع purge تُحذف عهده وكل حركاته (لحسابات التجربة)
    $this->on('DELETE', '/api/users/:id', function ($user, $p, $q, $b) use ($D) {
      $this->adminOnly($user);
      $u = $this->find('users', $p['id'], 'المستخدم');
      if ($u->id === $user->id) fail(400, 'لا يمكنك حذف حسابك — ادخل بحساب مدير آخر');
      if ($u->role === 'admin' && !some($D()->users, fn($x) => $x->role === 'admin' && ($x->active ?? null) !== false && $x->id !== $u->id)) fail(400, 'لا يمكن حذف آخر مدير للنظام');
      $purge = g($q, 'purge') === '1' || g($q, 'purge') === 'true' || g($b, 'purge') === true;
      $cs = filt($D()->custodies, fn($c) => $c->employeeId === $u->id);
      if ($cs && !$purge) fail(400, "على {$u->name} عدد " . count($cs) . ' عهدة — احذفها أولاً، أو استخدم «حذف مع كل حركاته»، أو أوقف الحساب بدل الحذف');
      foreach ($cs as $c) $this->removeCustody($user, $c);
      $D()->requests = filt($D()->requests, fn($r) => $r->employeeId !== $u->id);
      foreach ($D()->assets as $a) if (($a->holderId ?? null) === $u->id) { $a->holderId = null; $a->status = 'available'; $a->acknowledged = false; }
      $D()->checkins = filt($D()->checkins, fn($x) => $x->employeeId !== $u->id);
      $D()->notifications = filt($D()->notifications, fn($n) => $n->userId !== $u->id);
      foreach (get_object_vars($D()->sessions) as $tk => $sv) if ((is_object($sv) ? ($sv->userId ?? null) : $sv) === $u->id) unset($D()->sessions->$tk);
      $D()->users = filt($D()->users, fn($x) => $x->id !== $u->id);
      $this->log($user, 'حذف مستخدم', "{$u->name} ({$u->username})" . ($cs ? ' مع ' . count($cs) . ' عهدة' : ''), 'user', $u->id);
      return obj(['ok' => true]);
    });
    $this->on('DELETE', '/api/cost-centers/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $c = $this->find('costCenters', $p['id'], 'مركز التكلفة');
      $used = count(filt($D()->expenses, fn($e) => ($e->costCenterId ?? null) === $c->id)) + count(filt($D()->custodies, fn($x) => ($x->costCenterId ?? null) === $c->id)) + count(filt($D()->assets, fn($a) => ($a->costCenterId ?? null) === $c->id));
      if ($used) fail(400, "مركز التكلفة مستخدم في {$used} سجل — انقل السجلات أو أغلقه بدل الحذف");
      if (some($D()->costCenters, fn($x) => ($x->parentId ?? null) === $c->id)) fail(400, 'لهذا المركز مراكز فرعية — احذفها أو انقلها أولاً');
      $D()->costCenters = filt($D()->costCenters, fn($x) => $x->id !== $c->id);
      $this->log($user, 'حذف مركز تكلفة', jstrim(orv($c->code ?? null, '') . ' ' . $c->name), 'costCenter', $c->id);
      return obj(['ok' => true]);
    });
    $this->on('DELETE', '/api/categories/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $c = $this->find('categories', $p['id'], 'البند');
      $used = count(filt($D()->expenses, fn($e) => $e->categoryId === $c->id));
      if ($used) fail(400, "البند مستخدم في {$used} مصروف — غيّر بند هذه المصروفات أو أوقفه بدل الحذف");
      $D()->categories = filt($D()->categories, fn($x) => $x->id !== $c->id);
      $this->log($user, 'حذف بند', $c->name, 'category', $c->id);
      return obj(['ok' => true]);
    });
    $this->on('DELETE', '/api/sources/:id', function ($user, $p) use ($D) {
      $this->adminOnly($user);
      $x = $this->find('fundSources', $p['id'], 'المصدر');
      $used = count(filt($D()->tx, fn($t) => ($t->sourceId ?? null) === $x->id));
      if ($used) fail(400, "المصدر مستخدم في {$used} حركة — أوقفه بدل الحذف");
      $D()->fundSources = filt($D()->fundSources, fn($s) => $s->id !== $x->id);
      $this->log($user, 'حذف مصدر أموال', $x->name, 'source', $x->id);
      return obj(['ok' => true]);
    });
  }

  private function createCustodyShell($user, $to, $from, $amount, $b) {
    $t = obj(['id' => $this->env->uid(), 'no' => $this->nextNo('CU'), 'employeeId' => $to->id, 'kind' => $from->kind, 'purpose' => "محولة من عهدة {$from->no} — {$from->purpose}", 'costCenterId' => $from->costCenterId ?? null, 'issueDate' => $this->dateOr(g($b, 'date')), 'dueDate' => $from->dueDate ?? null, 'status' => 'open', 'createdBy' => $user->id, 'createdAt' => $this->env->now(), 'closedAt' => null, 'notes' => '']);
    $this->D()->custodies[] = $t;
    return $t;
  }
  private function assetView($a) { return ext($a, ['statusName' => ASSET_STATUS[$a->status] ?? null, 'holderName' => truthy($a->holderId ?? null) ? $this->userName($a->holderId) : '', 'costCenterName' => $this->ccName($a->costCenterId ?? null)]); }
  private function moveAsset($user, $a, $b) {
    $type = g($b, 'type');
    $type = is_string($type) && isset(ASSET_MOVES[$type]) ? $type : fail(400, 'نوع حركة غير صالح');
    $fromId = $a->holderId ?? null;
    $toId = null;
    if ($type === 'assign' || $type === 'transfer') {
      $to = first($this->D()->users, fn($u) => $u->id === g($b, 'toId') && ($u->active ?? null) !== false) ?? fail(400, 'اختر الموظف المستلم');
      if ($type === 'assign' && $a->status === 'assigned') fail(400, 'الأصل مسلَّم بالفعل — استخدم النقل');
      if ($type === 'transfer' && $a->status !== 'assigned') fail(400, 'الأصل غير مسلَّم لأحد');
      $toId = $to->id; $a->holderId = $to->id; $a->status = 'assigned'; $a->acknowledged = false;
      $this->notify($to->id, "تم تسليمك عهدة عينية: {$a->name} ({$a->no}) — يرجى الإقرار بالاستلام", '#/asset/' . $a->id);
    } else {
      $a->holderId = null;
      $a->status = ['return' => 'available', 'available' => 'available', 'maintenance' => 'maintenance', 'lost' => 'lost', 'retire' => 'retired'][$type];
      $a->acknowledged = false;
      if (truthy($fromId)) $this->notify($fromId, ASSET_MOVES[$type] . ": {$a->name} ({$a->no}) — أُخلي طرفك منها", '#/asset/' . $a->id);
    }
    if (truthy(g($b, 'condition'))) $a->condition = $this->opt($b->condition);
    $m = obj(['id' => $this->env->uid(), 'assetId' => $a->id, 'type' => $type, 'fromId' => $fromId, 'toId' => $toId, 'date' => $this->dateOr(g($b, 'date')), 'condition' => orv($this->opt(g($b, 'condition')), $a->condition ?? null), 'note' => $this->opt(g($b, 'note')), 'createdBy' => $user->id, 'createdAt' => $this->env->now()]);
    $this->D()->assetMoves[] = $m;
    $this->log($user, ASSET_MOVES[$type], "{$a->no} {$a->name}" . ($toId ? ' ← ' . $this->userName($toId) : ''), 'asset', $a->id);
    return $m;
  }

  public function handle($method, $path, $query, $body, $user) {
    foreach ($this->routes as $r) {
      if ($r['method'] !== $method || !preg_match($r['re'], $path, $m)) continue;
      $p = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
      $result = ($r['fn'])($user, $p, is_object($query) ? $query : obj((array)$query), is_object($body) ? $body : new \stdClass());
      if ($method !== 'GET') $this->env->save();
      return $result;
    }
    fail(404, 'المسار غير موجود');
  }

  public function login($username, $password) {
    $name = lower(jstrim(jsstr(orv($username, ''))));
    $u = first($this->D()->users, fn($x) => $x->username === $name);
    if (!$u || !$this->env->verifyPassword($u, orv($password, ''))) fail(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
    if (($u->active ?? null) === false) fail(403, 'الحساب موقوف، راجع الإدارة');
    return $u;
  }
  public function needsSetup() { return !$this->D()->users; }
  public function setup($b) {
    if (!$this->needsSetup()) fail(400, 'تم إعداد النظام مسبقاً');
    if (mb_strlen(jsstr(orv(g($b, 'password'), ''))) < 4) fail(400, 'كلمة المرور يجب ألا تقل عن 4 أحرف');
    $u = obj(array_merge(['id' => $this->env->uid(), 'name' => $this->text(g($b, 'name'), 'اسمك'), 'username' => lower($this->text(g($b, 'username'), 'اسم المستخدم')), 'role' => 'admin', 'jobTitle' => 'مدير', 'phone' => '', 'department' => '', 'custodyLimit' => 0, 'active' => true, 'createdAt' => $this->env->now()], $this->env->hashPassword(g($b, 'password'))));
    $this->D()->users[] = $u;
    $this->S()->companyName = $this->opt(g($b, 'companyName'));
    $this->log($u, 'إعداد النظام', $this->S()->companyName, 'settings', null);
    $this->env->save();
    return $u;
  }
}

// ---------- بيانات تجريبية ----------
function seedDemo($env) {
  $db = $env->db;
  $core = new Core($env);
  $admin = $core->setup(obj(['name' => 'أحمد المدير', 'username' => 'admin', 'password' => 'admin', 'companyName' => 'شركة الخطوط المعدنية للمقاولات العامة']));
  $call = fn($u, $m, $p, $b) => $core->handle($m, $p, new \stdClass(), obj($b), $u);
  $db->settings->vatNumber = '300000000000003';
  $db->settings->address = 'المملكة العربية السعودية';
  $mk = fn($name, $username, $role, $jobTitle, $custodyLimit = null) => $call($admin, 'POST', '/api/users', ['name' => $name, 'username' => $username, 'password' => '1234', 'role' => $role, 'jobTitle' => $jobTitle, 'custodyLimit' => $custodyLimit]);
  $mk('سارة المحاسبة', 'sara', 'accountant', 'محاسبة');
  [$m, $k, $o] = [$mk('محمد أحمد', 'mohamed', 'employee', 'مهندس موقع', 15000), $mk('خالد سعيد', 'khaled', 'employee', 'مندوب مشتريات', 10000), $mk('عمر حسن', 'omar', 'employee', 'سائق', 4000)];
  $U = fn($id) => first($db->users, fn($u) => $u->id === $id);
  [$cashBox, $bank, $owner] = $db->fundSources;
  $bank->name = 'مصرف الراجحي — الحساب الجاري'; $bank->accountNo = 'SA00 8000 0000 0000 0000 0000';
  $bank2 = $call($admin, 'POST', '/api/sources', ['name' => 'البنك الأهلي', 'type' => 'bank']);
  $client = $call($admin, 'POST', '/api/sources', ['name' => 'دفعة مقدمة من عميل مشروع الفيلا', 'type' => 'client']);
  $cc = fn($code, $name, $type, $budget, $parentId = null) => $call($admin, 'POST', '/api/cost-centers', ['code' => $code, 'name' => $name, 'type' => $type, 'budget' => $budget, 'parentId' => $parentId]);
  $p1 = $cc('P-101', 'مشروع مجمع الورود السكني', 'project', 80000);
  $p1a = $cc('P-101-1', 'الهيكل الخرساني', 'project', 45000, $p1->id);
  $p1b = $cc('P-101-2', 'الأعمال المعدنية والتشطيبات', 'project', 30000, $p1->id);
  $p2 = $cc('P-102', 'مشروع فيلا حي الملقا', 'project', 30000);
  $p3 = $cc('P-103', 'مستودعات المدينة الصناعية', 'project', 50000);
  $adm = $cc('G-900', 'الإدارة العامة', 'department', 15000);
  $veh = $cc('G-910', 'المعدات والنقل', 'vehicle', 12000, $adm->id);
  $cat = fn($code) => first($db->categories, fn($c) => $c->code === $code)->id;
  $day = fn($n) => gmdate('Y-m-d', (int)floor(microtime(true) - $n * 86400));
  $c1 = $call($admin, 'POST', '/api/custodies', ['employeeId' => $m->id, 'kind' => 'permanent', 'amount' => 5000, 'purpose' => 'عهدة مستديمة لمصروفات موقع مجمع الورود', 'costCenterId' => $p1a->id, 'issueDate' => $day(12), 'sourceId' => $bank->id, 'method' => 'تحويل بنكي', 'ref' => 'TRX-55120']);
  $c2 = $call($admin, 'POST', '/api/custodies', ['employeeId' => $k->id, 'kind' => 'temporary', 'amount' => 3000, 'purpose' => 'شراء مواد تشطيب ودهانات', 'costCenterId' => $p1b->id, 'issueDate' => $day(20), 'dueDate' => $day(5), 'sourceId' => $cashBox->id]);
  $c3 = $call($admin, 'POST', '/api/custodies', ['employeeId' => $o->id, 'kind' => 'permanent', 'amount' => 1500, 'purpose' => 'وقود وصيانة المعدات', 'costCenterId' => $veh->id, 'issueDate' => $day(8), 'sourceId' => $owner->id]);
  $call($admin, 'POST', '/api/custodies', ['employeeId' => $m->id, 'kind' => 'temporary', 'amount' => 2000, 'purpose' => 'مشتريات عاجلة لفيلا الملقا', 'costCenterId' => $p2->id, 'issueDate' => $day(3), 'dueDate' => $day(-10), 'sourceId' => $client->id]);
  $call($admin, 'POST', '/api/custodies/' . $c2->id . '/tx', ['type' => 'topup', 'amount' => 500, 'sourceId' => $bank2->id, 'method' => 'تحويل بنكي', 'date' => $day(9), 'note' => 'زيادة لشراء دهانات إضافية']);
  $ex = fn($u, $c, $ccId, $code, $amount, $description, $vendor, $ago, $vatIncluded) => $call($U($u->id), 'POST', '/api/expenses', ['custodyId' => $c->id, 'costCenterId' => $ccId, 'categoryId' => $cat($code), 'amount' => $amount, 'description' => $description, 'vendor' => $vendor, 'date' => $day($ago), 'vatIncluded' => $vatIncluded, 'invoiceNo' => $vatIncluded ? 'INV-' . (1000 + $ago) : '']);
  $e1 = $ex($m, $c1, $p1a->id, '5101', 1250, 'أسمنت 25 كيس', 'مؤسسة الإعمار', 10, true);
  $e2 = $ex($m, $c1, $p1a->id, '5105', 600, 'عمال تحميل 4 أشخاص', '', 7, false);
  $ex($m, $c1, $p1a->id, '5102', 380, 'نقل حديد للموقع', 'نقليات السريع', 1, false);
  $ex($m, $c1, $p3->id, '5104', 245, 'وجبات فريق العمل', 'مطعم البيت', 0, true);
  $e5 = $ex($k, $c2, $p1b->id, '5101', 1740, 'دهانات ومعجون', 'مركز الألوان', 15, true);
  $e6 = $ex($k, $c2, $p1b->id, '5106', 940, 'مثقاب وعدد يدوية', 'محل الأدوات', 9, true);
  $ex($k, $c2, $p1b->id, '5104', 210, 'ضيافة', '', 3, false);
  $e8 = $ex($o, $c3, $veh->id, '5103', 450, 'تعبئة ديزل', 'محطة الوقود', 6, true);
  $ex($o, $c3, $veh->id, '5107', 1450, 'صيانة فرامل الشاحنة', 'ورشة الأمل', 2, true);
  $call($admin, 'POST', '/api/expenses/review', ['ids' => [$e1->id, $e2->id, $e5->id, $e6->id, $e8->id], 'status' => 'approved']);
  $call($admin, 'POST', '/api/custodies/' . $c1->id . '/settle', ['replenish' => true, 'date' => $day(4), 'sourceId' => $bank->id, 'method' => 'تحويل بنكي']);
  $call($U($k->id), 'POST', '/api/requests', ['type' => 'cash', 'amount' => 2000, 'purpose' => 'شراء أدوات سباكة لفيلا الملقا', 'costCenterId' => $p2->id, 'kind' => 'temporary']);
  $a1 = $call($admin, 'POST', '/api/assets', ['name' => 'لابتوب Dell Latitude', 'category' => 'أجهزة حاسب', 'serial' => 'DL-77821', 'value' => 4200, 'costCenterId' => $adm->id, 'assignTo' => $m->id]);
  $call($admin, 'POST', '/api/assets', ['name' => 'شاحنة إيسوزو 2022', 'category' => 'مركبات', 'serial' => 'أ ب ج 4521', 'value' => 145000, 'costCenterId' => $veh->id, 'assignTo' => $o->id]);
  $call($admin, 'POST', '/api/assets', ['name' => 'جهاز مساحة ليزر', 'category' => 'معدات وعدد', 'serial' => 'LS-3390', 'value' => 2800, 'costCenterId' => $p1->id]);
  $call($U($m->id), 'POST', '/api/assets/' . $a1->id . '/ack', []);
  foreach ([[$m, 'yes'], [$m, 'no'], [$k, 'no'], [$o, 'yes']] as [$u, $ans]) $call($U($u->id), 'POST', '/api/checkins', ['answer' => $ans]);
}
