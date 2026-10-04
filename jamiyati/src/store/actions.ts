// عمليات الأعمال — كل عملية تتحقق من الصلاحية وتُسجل في سجل النشاط غير القابل للحذف.
import {
  assignByRequests,
  buildSchedule,
  canPostpone,
  potAmount,
  seededShuffle,
  validateShares,
  withdrawalSettlement,
} from '../domain/calc';
import { todayISO } from '../domain/dates';
import type { Circle, DB, Frequency, Member, PaymentMethod, Share } from '../domain/types';
import { L } from '../lib/i18n';
import { appendLog, getDB, mutate, nowISO, uid } from './db';
import { FREE_LIMITS, ledgerFor, circleView, organizedActiveCount, roleIn } from './selectors';

export class AppError extends Error {}

const fail = (ar: string, en: string): never => {
  throw new AppError(L(ar, en));
};

function me(db: DB) {
  const u = db.users.find((x) => x.id === db.currentUserId);
  if (!u) fail('يجب تسجيل الدخول أولاً', 'Please sign in first');
  return u!;
}

function circleOf(db: DB, id: string) {
  const i = db.circles.findIndex((c) => c.id === id);
  if (i < 0) fail('الجمعية غير موجودة', 'Circle not found');
  return { c: db.circles[i], i };
}

function requireRole(db: DB, circleId: string, roles: string[]) {
  const r = roleIn(db, circleId, db.currentUserId);
  if (!r || !roles.includes(r)) fail('ليست لديك صلاحية لهذه العملية', 'You are not allowed to do this');
  return r!;
}

const memberName = (db: DB, id: string) => db.members.find((m) => m.id === id)?.name ?? '؟';

function notify(db: DB, userIds: (string | undefined)[], circleId: string, kind: DB['notifications'][number]['kind'], text: string, key?: string) {
  for (const userId of new Set(userIds.filter(Boolean) as string[])) {
    if (key && db.notifications.some((n) => n.userId === userId && n.key === key)) continue;
    db.notifications.push({ id: uid('n_'), userId, circleId, at: nowISO(), kind, text, read: false, key });
  }
}

const staffUserIds = (db: DB, circleId: string) => {
  const c = db.circles.find((x) => x.id === circleId)!;
  return [c.organizerId, ...db.members.filter((m) => m.circleId === circleId && m.role === 'assistant' && m.status === 'active').map((m) => m.userId)];
};

// ───────── المصادقة (تجريبية محلياً — راجع src/lib/auth.ts للإنتاج) ─────────

export function signIn(phone: string, name: string) {
  mutate((db) => {
    let u = db.users.find((x) => x.phone === phone);
    if (!u) {
      u = { id: uid('u_'), name: name || phone, phone, shareReputation: true, showPhone: false, createdAt: nowISO() };
      db.users.push(u);
    } else if (name && u.name !== name && u.name === u.phone) {
      u.name = name;
    }
    db.currentUserId = u.id;
    // ربط أي عضوية أُضيفت يدوياً بهذا الرقم
    db.members = db.members.map((m) => (!m.userId && m.phone === phone ? { ...m, userId: u!.id } : m));
  });
}

export function signOut() {
  mutate((db) => {
    db.currentUserId = undefined;
  });
}

export function updateProfile(patch: Partial<Pick<DB['users'][number], 'name' | 'preferredPayment' | 'shareReputation' | 'showPhone'>>) {
  mutate((db) => {
    const u = me(db);
    db.users = db.users.map((x) => (x.id === u.id ? { ...x, ...patch } : x));
  });
}

// ───────── إنشاء الجمعية ─────────

export interface NewCircleInput {
  name: string;
  installment: number;
  currency: string;
  frequency: Frequency;
  startDate: string;
  graceDays: number;
  sharesCount: number;
  rules: string;
  organizerUnits: number; // 0 = المنظم لا يشارك بسهم
  members: { name: string; phone: string; units: number }[];
}

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[0O1I]/g, 'X');

export function createCircle(input: NewCircleInput): string {
  let id = '';
  mutate((db) => {
    const u = me(db);
    if (!db.settings.premium && organizedActiveCount(db, u.id) >= FREE_LIMITS.circles)
      fail(`الخطة المجانية تسمح بـ ${FREE_LIMITS.circles} جمعيات نشطة. اشترك في الخطة المميزة لجمعيات بلا حد.`, `Free plan allows ${FREE_LIMITS.circles} active circles.`);
    if (!input.name.trim()) fail('اكتب اسم الجمعية', 'Enter a name');
    if (!(input.installment > 0)) fail('قيمة القسط يجب أن تكون أكبر من صفر', 'Installment must be positive');
    if (!(input.sharesCount >= 2)) fail('عدد الأسهم يجب أن يكون 2 على الأقل', 'At least 2 shares');
    id = uid('c_');
    const circle: Circle = {
      id,
      name: input.name.trim(),
      installment: input.installment,
      currency: input.currency,
      frequency: input.frequency,
      startDate: input.startDate,
      graceDays: Math.max(0, input.graceDays),
      sharesCount: input.sharesCount,
      rules: input.rules.trim(),
      organizerId: u.id,
      status: 'draft',
      orderMethod: 'lottery',
      orderLocked: false,
      inviteCode: genCode(),
      postponements: [],
      createdAt: nowISO(),
    };
    db.circles.push(circle);
    appendLog(db, id, u.id, 'circle.create', `أنشأ الجمعية "${circle.name}": قسط ${circle.installment} ${circle.currency}، ${circle.sharesCount} أسهم`);
    const orgMember: Member = {
      id: uid('m_'),
      circleId: id,
      userId: u.id,
      name: u.name,
      phone: u.phone,
      role: 'organizer',
      status: 'active',
      acceptedRulesAt: nowISO(),
      joinedAt: nowISO(),
      preferredPayment: u.preferredPayment,
    };
    db.members.push(orgMember);
    if (input.organizerUnits > 0) allocateShares(db, circle, orgMember.id, input.organizerUnits);
    for (const m of input.members) addMemberInternal(db, circle, m.name, m.phone, m.units);
  });
  return id;
}

function allocateShares(db: DB, circle: Circle, memberId: string, units: number) {
  const shares = db.shares.filter((s) => s.circleId === circle.id);
  let left = units;
  // نصف السهم: أكمل سهماً نصفياً موجوداً أولاً
  if (left % 1 !== 0) {
    const half = shares.find((s) => s.holders.reduce((a, h) => a + h.fraction, 0) === 0.5);
    if (half) {
      db.shares = db.shares.map((s) => (s.id === half.id ? { ...s, holders: [...s.holders, { memberId, fraction: 0.5 }] } : s));
      left -= 0.5;
    }
  }
  const totalShares = db.shares.filter((s) => s.circleId === circle.id).length + Math.ceil(left);
  if (totalShares > circle.sharesCount) {
    if (circle.orderLocked) fail('اكتملت الأسهم ولا يمكن إضافة المزيد بعد بدء الجمعية', 'All shares are taken');
    // قبل البدء: نزيد عدد الأسهم تلقائياً
    db.circles = db.circles.map((c) => (c.id === circle.id ? { ...c, sharesCount: totalShares } : c));
    circle.sharesCount = totalShares;
  }
  while (left > 0) {
    const fraction = left >= 1 ? 1 : 0.5;
    const share: Share = { id: uid('s_'), circleId: circle.id, position: 0, holders: [{ memberId, fraction }] };
    db.shares.push(share);
    left -= fraction;
  }
}

function addMemberInternal(db: DB, circle: Circle, name: string, phone: string, units: number, userId?: string): Member {
  const u = me(db);
  const memberCount = db.members.filter((m) => m.circleId === circle.id && m.status === 'active').length;
  if (!db.settings.premium && memberCount >= FREE_LIMITS.members)
    fail(`الخطة المجانية تسمح بـ ${FREE_LIMITS.members} أعضاء لكل جمعية`, `Free plan allows ${FREE_LIMITS.members} members per circle`);
  if (!name.trim()) fail('اكتب اسم العضو', 'Enter member name');
  if (!(units > 0) || (units * 2) % 1 !== 0) fail('عدد الأسهم يجب أن يكون نصفاً أو رقماً صحيحاً', 'Shares must be whole or half');
  const linked = userId ?? db.users.find((x) => x.phone === phone && phone)?.id;
  if (linked && db.members.some((m) => m.circleId === circle.id && m.userId === linked && m.status === 'active'))
    fail('هذا الشخص عضو في الجمعية بالفعل', 'Already a member');
  const m: Member = {
    id: uid('m_'),
    circleId: circle.id,
    userId: linked,
    name: name.trim(),
    phone,
    role: 'member',
    status: 'active',
    joinedAt: nowISO(),
    acceptedRulesAt: userId ? nowISO() : undefined,
  };
  db.members.push(m);
  allocateShares(db, circle, m.id, units);
  appendLog(db, circle.id, u.id, 'member.add', `أضاف العضو ${m.name} (${units} سهم)`);
  return m;
}

export function addMember(circleId: string, name: string, phone: string, units: number) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    if (c.status !== 'draft' && c.status !== 'active') fail('الجمعية منتهية', 'Circle has ended');
    addMemberInternal(db, { ...c }, name, phone, units);
  });
}

export function findByCode(code: string) {
  return getDB().circles.find((c) => c.inviteCode === code.trim().toUpperCase());
}

export function joinByCode(code: string, units: number) {
  let circleId = '';
  mutate((db) => {
    const u = me(db);
    const c = db.circles.find((x) => x.inviteCode === code.trim().toUpperCase());
    if (!c) fail('كود الدعوة غير صحيح', 'Invalid invite code');
    if (c!.status !== 'draft') fail('هذه الجمعية بدأت ولا تقبل أعضاء جدداً', 'Circle already started');
    circleId = c!.id;
    const m = addMemberInternal(db, { ...c! }, u.name, u.phone, units, u.id);
    m.acceptedRulesAt = nowISO();
    appendLog(db, c!.id, u.id, 'member.join', `انضم ${u.name} عبر كود الدعوة ووافق على قواعد الجمعية`);
    notify(db, [c!.organizerId], c!.id, 'info', L(`انضم ${u.name} إلى "${c!.name}"`, `${u.name} joined "${c!.name}"`));
  });
  return circleId;
}

export function updateMember(memberId: string, patch: Partial<Pick<Member, 'name' | 'phone' | 'notes' | 'preferredPayment' | 'guarantor' | 'role'>>) {
  mutate((db) => {
    const m = db.members.find((x) => x.id === memberId);
    if (!m) fail('العضو غير موجود', 'Member not found');
    const isSelf = m!.userId === db.currentUserId;
    const role = roleIn(db, m!.circleId, db.currentUserId);
    if (!isSelf && role !== 'organizer') fail('ليست لديك صلاحية', 'Not allowed');
    if (patch.role && role !== 'organizer') fail('تغيير الدور للمنظم فقط', 'Only organizer can change roles');
    if (patch.role === 'assistant' && !m!.userId) fail('المساعد يجب أن يكون مستخدماً للتطبيق', 'Assistant must use the app');
    db.members = db.members.map((x) => (x.id === memberId ? { ...x, ...patch } : x));
    const changes = Object.keys(patch).join('، ');
    appendLog(db, m!.circleId, db.currentUserId!, 'member.update', `عدّل بيانات ${m!.name}: ${changes}`);
  });
}

export function removeMemberBeforeStart(memberId: string) {
  mutate((db) => {
    const m = db.members.find((x) => x.id === memberId)!;
    requireRole(db, m.circleId, ['organizer']);
    const { c } = circleOf(db, m.circleId);
    if (c.status !== 'draft') fail('بعد البدء استخدم "انسحاب عضو"', 'After start use "withdraw"');
    if (m.role === 'organizer') fail('لا يمكن حذف المنظم', 'Cannot remove organizer');
    db.members = db.members.filter((x) => x.id !== memberId);
    db.shares = db.shares
      .map((s) => ({ ...s, holders: s.holders.filter((h) => h.memberId !== memberId) }))
      .filter((s) => s.circleId !== c.id || s.holders.length > 0);
    appendLog(db, c.id, db.currentUserId!, 'member.remove', `أزال ${m.name} قبل بدء الجمعية`);
  });
}

export function updateCircle(circleId: string, patch: Partial<Pick<Circle, 'name' | 'rules' | 'graceDays' | 'installment' | 'startDate' | 'sharesCount' | 'frequency' | 'orderMethod'>>) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    const financial = ['installment', 'startDate', 'sharesCount', 'frequency'] as const;
    if (c.status !== 'draft' && financial.some((k) => k in patch)) fail('لا يمكن تعديل القيم المالية بعد البدء', 'Financial terms are locked after start');
    if (patch.sharesCount !== undefined) {
      const used = db.shares.filter((s) => s.circleId === circleId).length;
      if (patch.sharesCount < used) fail(`يوجد ${used} أسهم مخصصة بالفعل`, `${used} shares already allocated`);
    }
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, ...patch } : x));
    appendLog(db, circleId, db.currentUserId!, 'circle.update', `عدّل إعدادات الجمعية: ${Object.entries(patch).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).join('، ')}`);
  });
}

// ───────── الترتيب والقرعة ─────────

export function setManualOrder(circleId: string, orderedShareIds: string[]) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    if (c.orderLocked) fail('الترتيب مقفل بعد بدء الجمعية. استخدم طلب تبديل.', 'Order is locked. Use a swap request.');
    db.shares = db.shares.map((s) => (s.circleId === circleId ? { ...s, position: orderedShareIds.indexOf(s.id) + 1 } : s));
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, orderMethod: 'manual' } : x));
    appendLog(db, circleId, db.currentUserId!, 'order.manual', `رتّب الأدوار يدوياً: ${orderedShareIds.map((id, i) => `${i + 1}-${shareLabel(db, id)}`).join('، ')}`);
  });
}

function shareLabel(db: DB, shareId: string) {
  const s = db.shares.find((x) => x.id === shareId);
  return s ? s.holders.map((h) => memberName(db, h.memberId)).join(' و') : '؟';
}

/** القرعة: البذرة تُعلن وتُحفظ ليتمكن أي عضو من التحقق من النتيجة */
export function runLottery(circleId: string, seed: number): string[] {
  let result: string[] = [];
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    if (c.orderLocked) fail('الترتيب مقفل', 'Order is locked');
    const ids = db.shares.filter((s) => s.circleId === circleId).map((s) => s.id).sort();
    const errs = validateShares(db.shares.filter((s) => s.circleId === circleId), c.sharesCount);
    if (errs.length) fail(`أكمل الأسهم قبل القرعة: ${errs[0]}`, `Complete shares first: ${errs[0]}`);
    result = seededShuffle(ids, seed);
    db.shares = db.shares.map((s) => (s.circleId === circleId ? { ...s, position: result.indexOf(s.id) + 1 } : s));
    const at = nowISO();
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, orderMethod: 'lottery', lottery: { seed, at, byUserId: db.currentUserId!, result } } : x));
    appendLog(db, circleId, db.currentUserId!, 'order.lottery', `أجرى القرعة الإلكترونية (البذرة ${seed}): ${result.map((id, i) => `${i + 1}-${shareLabel(db, id)}`).join('، ')}`);
    const ids2 = db.members.filter((m) => m.circleId === circleId).map((m) => m.userId);
    notify(db, ids2, circleId, 'info', L(`تمت قرعة "${c.name}". اطّلع على دورك.`, `Lottery done for "${c.name}".`));
  });
  return result;
}

export function requestPosition(shareId: string, position: number) {
  mutate((db) => {
    const s = db.shares.find((x) => x.id === shareId)!;
    const { c } = circleOf(db, s.circleId);
    if (c.orderLocked) fail('الترتيب مقفل', 'Order is locked');
    const mine = s.holders.some((h) => db.members.find((m) => m.id === h.memberId)?.userId === db.currentUserId);
    if (!mine && roleIn(db, c.id, db.currentUserId) !== 'organizer') fail('ليست لديك صلاحية', 'Not allowed');
    db.shares = db.shares.map((x) => (x.id === shareId ? { ...x, requestedPosition: position, requestedAt: nowISO() } : x));
    appendLog(db, c.id, db.currentUserId!, 'order.request', `طلب ${shareLabel(db, shareId)} الدور رقم ${position}`);
  });
}

export function applyRequestOrder(circleId: string) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    if (c.orderLocked) fail('الترتيب مقفل', 'Order is locked');
    const shares = db.shares.filter((s) => s.circleId === circleId);
    const map = assignByRequests(shares.map((s) => ({ shareId: s.id, requestedAt: s.requestedAt, requestedPosition: s.requestedPosition })), shares.length);
    db.shares = db.shares.map((s) => (s.circleId === circleId ? { ...s, position: map[s.id] } : s));
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, orderMethod: 'requests' } : x));
    appendLog(db, circleId, db.currentUserId!, 'order.requests', 'رتّب الأدوار حسب أولوية الطلب');
  });
}

export function startCircle(circleId: string) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    const shares = db.shares.filter((s) => s.circleId === circleId);
    const errs = validateShares(shares, c.sharesCount);
    if (errs.length) fail(`لا يمكن البدء: ${errs.join('، ')}`, `Cannot start: ${errs.join(', ')}`);
    if (shares.some((s) => !s.position)) fail('حدد ترتيب الاستلام أولاً (يدوي أو قرعة)', 'Set the payout order first');
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, status: 'active', orderLocked: true } : x));
    appendLog(db, circleId, db.currentUserId!, 'circle.start', 'بدأت الجمعية وقُفل ترتيب الاستلام');
    const pot = potAmount(c);
    const first = shares.find((s) => s.position === 1)!;
    notify(
      db,
      db.members.filter((m) => m.circleId === circleId).map((m) => m.userId),
      circleId,
      'turn',
      L(`بدأت "${c.name}". الدور الأول: ${shareLabel(db, first.id)}، المبلغ ${pot} ${c.currency}`, `"${c.name}" started.`),
    );
  });
}

// ───────── طلبات التبديل ─────────

export function requestSwap(fromShareId: string, toShareId: string, note: string) {
  mutate((db) => {
    const from = db.shares.find((s) => s.id === fromShareId)!;
    const to = db.shares.find((s) => s.id === toShareId)!;
    const me_ = me(db);
    const myMemberIds = db.members.filter((m) => m.circleId === from.circleId && m.userId === me_.id).map((m) => m.id);
    const role = roleIn(db, from.circleId, me_.id);
    if (!from.holders.some((h) => myMemberIds.includes(h.memberId)) && role !== 'organizer') fail('يمكنك طلب تبديل دورك فقط', 'You can only swap your own turn');
    const paidOut = db.payouts.some((p) => p.circleId === from.circleId && (p.cycleIndex === from.position - 1 || p.cycleIndex === to.position - 1));
    if (paidOut) fail('لا يمكن تبديل دور تم استلامه', 'Cannot swap a turn already paid out');
    if (db.swaps.some((s) => s.status === 'open' && [s.fromShareId, s.toShareId].some((x) => x === fromShareId || x === toShareId)))
      fail('يوجد طلب تبديل مفتوح لأحد هذين الدورين', 'An open swap already involves one of these turns');
    const requester = db.members.find((m) => from.holders.some((h) => h.memberId === m.id))!;
    const swap = {
      id: uid('w_'),
      circleId: from.circleId,
      fromShareId,
      toShareId,
      requestedBy: requester.id,
      approvals: { from: nowISO() } as { from?: string; to?: string; organizer?: string },
      status: 'open' as const,
      createdAt: nowISO(),
      note,
    };
    if (role === 'organizer') swap.approvals.organizer = nowISO();
    db.swaps.push(swap);
    appendLog(db, from.circleId, me_.id, 'swap.request', `طلب تبديل الدور ${from.position} (${shareLabel(db, fromShareId)}) مع الدور ${to.position} (${shareLabel(db, toShareId)})`);
    notify(
      db,
      [...to.holders.map((h) => db.members.find((m) => m.id === h.memberId)?.userId), db.circles.find((c) => c.id === from.circleId)!.organizerId],
      from.circleId,
      'swap',
      L(`طلب تبديل أدوار من ${shareLabel(db, fromShareId)} بانتظار موافقتك`, 'A swap request needs your approval'),
    );
  });
}

export function answerSwap(swapId: string, approve: boolean) {
  mutate((db) => {
    const sw = db.swaps.find((s) => s.id === swapId);
    if (!sw || sw.status !== 'open') fail('الطلب غير متاح', 'Request not available');
    const u = me(db);
    const to = db.shares.find((s) => s.id === sw!.toShareId)!;
    const from = db.shares.find((s) => s.id === sw!.fromShareId)!;
    const isTo = to.holders.some((h) => db.members.find((m) => m.id === h.memberId)?.userId === u.id);
    const isOrg = roleIn(db, sw!.circleId, u.id) === 'organizer';
    if (!isTo && !isOrg) fail('ليست لديك صلاحية', 'Not allowed');
    const approvals = { ...sw!.approvals };
    if (isTo) approvals.to = nowISO();
    if (isOrg) approvals.organizer = nowISO();
    // المنظم إذا كان هو صاحب السهم المقابل تكفي موافقته للطرفين
    let status: 'open' | 'done' | 'rejected' = sw!.status;
    if (!approve) status = 'rejected';
    else if (approvals.from && approvals.to && approvals.organizer) status = 'done';
    db.swaps = db.swaps.map((s) => (s.id === swapId ? { ...s, approvals, status } : s));
    if (!approve) {
      appendLog(db, sw!.circleId, u.id, 'swap.reject', `رفض طلب تبديل الدورين ${from.position} و${to.position}`);
    } else if (status === 'done') {
      db.shares = db.shares.map((s) => (s.id === from.id ? { ...s, position: to.position } : s.id === to.id ? { ...s, position: from.position } : s));
      appendLog(db, sw!.circleId, u.id, 'swap.done', `نُفذ التبديل بموافقة الطرفين والمنظم: ${shareLabel(db, from.id)} ← الدور ${to.position}، ${shareLabel(db, to.id)} ← الدور ${from.position}`);
    } else {
      appendLog(db, sw!.circleId, u.id, 'swap.approve', `وافق على طلب تبديل الدورين ${from.position} و${to.position}`);
    }
    const requester = db.members.find((m) => m.id === sw!.requestedBy)?.userId;
    notify(db, [requester], sw!.circleId, 'swap', !approve ? L('رُفض طلب التبديل', 'Swap rejected') : status === 'done' ? L('تم تنفيذ التبديل', 'Swap completed') : L('موافقة جديدة على طلب التبديل', 'Swap approved by one party'));
  });
}

// ───────── الدفعات ─────────

export interface PaymentInput {
  circleId: string;
  memberId: string;
  cycleIndex: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  proofImage?: string;
  note?: string;
}

function nextReceiptNo(db: DB, circleId: string) {
  const n = db.payments.filter((p) => p.circleId === circleId && p.receiptNo).length + 1;
  const c = db.circles.find((x) => x.id === circleId)!;
  return `${c.inviteCode}-${String(n).padStart(4, '0')}`;
}

/** العضو يعلن الدفع (بانتظار التأكيد) أو المنظم يسجله مباشرة (مؤكد) */
export function submitPayment(input: PaymentInput): string {
  let id = '';
  mutate((db) => {
    const u = me(db);
    const role = roleIn(db, input.circleId, u.id);
    const member = db.members.find((m) => m.id === input.memberId);
    if (!member) fail('العضو غير موجود', 'Member not found');
    const isSelf = member!.userId === u.id;
    const staff = role === 'organizer' || role === 'assistant';
    if (!isSelf && !staff) fail('ليست لديك صلاحية', 'Not allowed');
    if (!(input.amount > 0)) fail('أدخل مبلغاً صحيحاً', 'Enter a valid amount');
    const { c } = circleOf(db, input.circleId);
    if (c.status !== 'active') fail('الجمعية غير نشطة', 'Circle is not active');
    if (!staff && !input.proofImage && input.method !== 'cash') fail('أرفق صورة إثبات التحويل', 'Attach a transfer proof');
    const direct = staff; // المنظم/المساعد يسجل مباشرة
    id = uid('p_');
    db.payments.push({
      id,
      circleId: input.circleId,
      cycleIndex: input.cycleIndex,
      memberId: input.memberId,
      amount: input.amount,
      method: input.method,
      status: direct ? 'confirmed' : 'pending',
      proofImage: input.proofImage,
      note: input.note,
      paidAt: input.paidAt,
      submittedBy: u.id,
      submittedAt: nowISO(),
      reviewedBy: direct ? u.id : undefined,
      reviewedAt: direct ? nowISO() : undefined,
      receiptNo: direct ? nextReceiptNo(db, input.circleId) : undefined,
    });
    const cyc = input.cycleIndex + 1;
    if (direct) {
      appendLog(db, c.id, u.id, 'payment.record', `سجّل دفعة ${member!.name} للدورة ${cyc}: ${input.amount} ${c.currency} (${input.method})`);
      notify(db, [member!.userId], c.id, 'info', L(`تم تأكيد دفعتك ${input.amount} ${c.currency} في "${c.name}"`, `Your payment was confirmed`));
    } else {
      appendLog(db, c.id, u.id, 'payment.submit', `أعلن ${member!.name} دفع ${input.amount} ${c.currency} للدورة ${cyc} مع إثبات`);
      notify(db, staffUserIds(db, c.id), c.id, 'proof', L(`${member!.name} رفع إثبات دفع ${input.amount} ${c.currency} في "${c.name}"`, `${member!.name} uploaded a payment proof`));
    }
  });
  return id;
}

export function reviewPayment(paymentId: string, approve: boolean, reason = '') {
  mutate((db) => {
    const p = db.payments.find((x) => x.id === paymentId);
    if (!p) fail('الدفعة غير موجودة', 'Payment not found');
    requireRole(db, p!.circleId, ['organizer', 'assistant']);
    if (p!.status !== 'pending') fail('تمت مراجعة هذه الدفعة مسبقاً', 'Already reviewed');
    if (!approve && !reason.trim()) fail('اذكر سبب الرفض', 'Enter a reason');
    const c = db.circles.find((x) => x.id === p!.circleId)!;
    db.payments = db.payments.map((x) =>
      x.id === paymentId
        ? {
            ...x,
            status: approve ? 'confirmed' : 'rejected',
            reviewedBy: db.currentUserId,
            reviewedAt: nowISO(),
            rejectReason: approve ? undefined : reason,
            receiptNo: approve ? nextReceiptNo(db, p!.circleId) : undefined,
          }
        : x,
    );
    const name = memberName(db, p!.memberId);
    appendLog(db, p!.circleId, db.currentUserId!, approve ? 'payment.confirm' : 'payment.reject', approve ? `أكّد دفعة ${name} (${p!.amount}) للدورة ${p!.cycleIndex + 1}` : `رفض دفعة ${name} (${p!.amount}): ${reason}`);
    const uidM = db.members.find((m) => m.id === p!.memberId)?.userId;
    notify(db, [uidM], c.id, 'info', approve ? L(`تم تأكيد دفعتك في "${c.name}" ✓`, 'Payment confirmed') : L(`رُفضت دفعتك في "${c.name}": ${reason}`, `Payment rejected: ${reason}`));
  });
}

/** لا حذف بعد التأكيد: الإلغاء يُبقي السجل مع السبب */
export function voidPayment(paymentId: string, reason: string) {
  mutate((db) => {
    const p = db.payments.find((x) => x.id === paymentId)!;
    requireRole(db, p.circleId, ['organizer']);
    if (!reason.trim()) fail('اذكر سبب الإلغاء', 'Enter a reason');
    if (p.status !== 'confirmed') fail('يمكن إلغاء الدفعات المؤكدة فقط', 'Only confirmed payments can be voided');
    db.payments = db.payments.map((x) => (x.id === paymentId ? { ...x, status: 'voided', voidReason: reason } : x));
    appendLog(db, p.circleId, db.currentUserId!, 'payment.void', `ألغى الدفعة ${p.receiptNo ?? p.id} (${p.amount}) لـ ${memberName(db, p.memberId)}: ${reason}`);
  });
}

// ───────── تسليم المبلغ للمستلم ─────────

export function recordPayout(circleId: string, cycleIndex: number, memberId: string, amount: number, method: PaymentMethod) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    const share = db.shares.find((s) => s.circleId === circleId && s.position === cycleIndex + 1);
    if (!share?.holders.some((h) => h.memberId === memberId)) fail('هذا العضو ليس صاحب الدور في هذه الدورة', 'Not the recipient of this cycle');
    if (db.payouts.some((p) => p.circleId === circleId && p.cycleIndex === cycleIndex && p.memberId === memberId)) fail('تم تسجيل التسليم مسبقاً', 'Already recorded');
    db.payouts.push({ id: uid('o_'), circleId, cycleIndex, shareId: share!.id, memberId, amount, deliveredAt: nowISO(), deliveredBy: db.currentUserId!, method });
    appendLog(db, circleId, db.currentUserId!, 'payout.deliver', `سلّم ${amount} ${c.currency} إلى ${memberName(db, memberId)} (دورة ${cycleIndex + 1})`);
    notify(db, [db.members.find((m) => m.id === memberId)?.userId], circleId, 'turn', L(`سلّمك المنظم ${amount} ${c.currency}. أكّد الاستلام من فضلك.`, 'Please confirm you received your payout'));
  });
}

export function confirmPayoutReceived(payoutId: string) {
  mutate((db) => {
    const p = db.payouts.find((x) => x.id === payoutId)!;
    const m = db.members.find((x) => x.id === p.memberId);
    if (m?.userId !== db.currentUserId && roleIn(db, p.circleId, db.currentUserId) !== 'organizer') fail('التأكيد للمستلم فقط', 'Only the recipient can confirm');
    db.payouts = db.payouts.map((x) => (x.id === payoutId ? { ...x, recipientConfirmedAt: nowISO() } : x));
    appendLog(db, p.circleId, db.currentUserId!, 'payout.confirm', `أكّد ${m?.name} استلام ${p.amount}`);
  });
}

// ───────── الحالات الخاصة ─────────

export function withdrawMember(memberId: string, replacement?: { name: string; phone: string }) {
  mutate((db) => {
    const m = db.members.find((x) => x.id === memberId)!;
    requireRole(db, m.circleId, ['organizer']);
    const { c } = circleOf(db, m.circleId);
    if (c.status !== 'active') fail('الانسحاب متاح للجمعيات النشطة. قبل البدء احذف العضو مباشرة.', 'Only for active circles');
    if (m.role === 'organizer') fail('لا يمكن للمنظم الانسحاب. أنهِ الجمعية بدلاً من ذلك.', 'Organizer cannot withdraw');
    const v = circleView(db, c.id, todayISO())!;
    const led = ledgerFor(db, v, m.id, todayISO());
    const entitled = led.units * v.pot;
    const s = withdrawalSettlement(led.paid, led.received, entitled);
    if (replacement && !s.canBeReplaced) fail('العضو استلم دوره، لا يمكن استبداله ويبقى ملتزماً بالسداد', 'Member already received the payout');
    db.members = db.members.map((x) => (x.id === memberId ? { ...x, status: 'withdrawn', withdrawnAt: nowISO() } : x));
    if (replacement) {
      const linked = db.users.find((u) => u.phone === replacement.phone)?.id;
      const r: Member = {
        id: uid('m_'),
        circleId: c.id,
        userId: linked,
        name: replacement.name,
        phone: replacement.phone,
        role: 'member',
        status: 'active',
        replacesMemberId: memberId,
        joinedAt: nowISO(),
      };
      db.members.push(r);
      db.shares = db.shares.map((sh) => (sh.circleId === c.id ? { ...sh, holders: sh.holders.map((h) => (h.memberId === memberId ? { ...h, memberId: r.id } : h)) } : sh));
      appendLog(
        db,
        c.id,
        db.currentUserId!,
        'member.replace',
        `انسحب ${m.name} قبل استلامه وحلّ محله ${r.name} ويرث دوره والتزاماته. يدفع البديل ${s.replacementCatchUp} ${c.currency} للمنسحب (ما دفعه سابقاً).`,
      );
    } else {
      appendLog(
        db,
        c.id,
        db.currentUserId!,
        'member.withdraw',
        s.phase === 'after_payout'
          ? `انسحب ${m.name} بعد استلامه ويبقى ملتزماً بسداد ${s.owedByMember} ${c.currency}`
          : `انسحب ${m.name} قبل استلامه؛ يُرد له ${s.refundToMember} ${c.currency}`,
      );
    }
  });
}

export function postponeCycle(circleId: string, beforeCycle: number, reason: string) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    const sched = buildSchedule(c);
    if (!canPostpone(sched, beforeCycle, todayISO())) fail('لا يمكن تأجيل دورة حلّ موعدها', 'Cannot postpone a cycle already due');
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, postponements: [...x.postponements, { beforeCycle, reason, at: nowISO() }] } : x));
    const after = buildSchedule({ ...c, postponements: [...c.postponements, { beforeCycle, reason, at: '' }] });
    appendLog(db, circleId, db.currentUserId!, 'cycle.postpone', `أجّل الدورة ${beforeCycle + 1} وما بعدها فترة واحدة (${reason}). الموعد الجديد ${after[beforeCycle].dueDate}`);
    notify(db, db.members.filter((m) => m.circleId === circleId).map((m) => m.userId), circleId, 'info', L(`أُجلت الدورة ${beforeCycle + 1} في "${c.name}" إلى ${after[beforeCycle].dueDate} (${reason})`, `Cycle postponed (${reason})`));
  });
}

export function terminateCircle(circleId: string, reason: string) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    if (!reason.trim()) fail('اذكر سبب الإنهاء', 'Enter a reason');
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, status: 'terminated', terminatedAt: nowISO() } : x));
    appendLog(db, circleId, db.currentUserId!, 'circle.terminate', `أنهى الجمعية مبكراً: ${reason}`);
  });
}

export function completeCircle(circleId: string) {
  mutate((db) => {
    requireRole(db, circleId, ['organizer']);
    const { c } = circleOf(db, circleId);
    const delivered = new Set(db.payouts.filter((p) => p.circleId === circleId).map((p) => p.cycleIndex));
    if (delivered.size < c.sharesCount) fail('لم تُسلَّم كل الأدوار بعد', 'Not all payouts are delivered');
    db.circles = db.circles.map((x) => (x.id === circleId ? { ...x, status: 'completed' } : x));
    appendLog(db, circleId, db.currentUserId!, 'circle.complete', 'اكتملت الجمعية واستلم الجميع 🎉');
  });
}

// ───────── الإشعارات والتذكيرات ─────────

export function markAllRead() {
  mutate((db) => {
    db.notifications = db.notifications.map((n) => (n.userId === db.currentUserId ? { ...n, read: true } : n));
  });
}

export function updateSettings(patch: Partial<DB['settings']>) {
  mutate((db) => {
    db.settings = { ...db.settings, ...patch };
  });
}


