// بيانات تجريبية واقعية — نسبية لتاريخ اليوم لتبقى حية دائماً:
// • "جمعية الأصدقاء": 10 أعضاء، 1000 ر.س شهرياً، بدأت قبل 3 أشهر، فيها عضو متأخر (خالد) وطلب تبديل مفتوح.
// • "جمعية العائلة": أسبوعية، المستخدم عضو فيها بنصف سهم مع أخيه (المنظِّمة هند).
// • "جمعية الزملاء 2025": مكتملة — تُغذي سجل الالتزام والشارات.
import { buildSchedule, potAmount, seededShuffle } from '../domain/calc';
import { addDays, addMonths, todayISO } from '../domain/dates';
import type { Circle, DB, Member, Payment, Payout, Share, User } from '../domain/types';
import { appendLog, emptyDB, uid } from './db';

const proofSvg = (name: string, amount: number, d: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect width="360" height="480" fill="#f4f7f6"/><rect x="20" y="20" width="320" height="440" rx="16" fill="#fff" stroke="#d6e2de"/><circle cx="180" cy="90" r="34" fill="#0f766e"/><path d="M163 90l12 12 22-24" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><text x="180" y="160" font-family="Tahoma" font-size="20" text-anchor="middle" fill="#0b3b36">تحويل ناجح</text><text x="180" y="210" font-family="Tahoma" font-size="34" font-weight="bold" text-anchor="middle" fill="#0b3b36">${amount} SAR</text><text x="300" y="270" font-family="Tahoma" font-size="15" text-anchor="end" fill="#55706b">من: ${name}</text><text x="300" y="305" font-family="Tahoma" font-size="15" text-anchor="end" fill="#55706b">التاريخ: ${d}</text><text x="300" y="340" font-family="Tahoma" font-size="15" text-anchor="end" fill="#55706b">رقم العملية: ${Math.floor(Math.random() * 9e9)}</text><text x="180" y="430" font-family="Tahoma" font-size="12" text-anchor="middle" fill="#9db1ad">صورة توضيحية — بيانات تجريبية</text></svg>`,
  );

const iso = (d: string, h = 10) => `${d}T${String(h).padStart(2, '0')}:15:00.000Z`;

export function buildDemoDB(today = todayISO()): DB {
  const db = emptyDB();
  db.settings.onboarded = true;

  const mkUser = (name: string, phone: string, showPhone = false, shareReputation = true): User => {
    const u: User = { id: uid('u_'), name, phone, showPhone, shareReputation, preferredPayment: 'bank', createdAt: iso(addMonths(today, -14)) };
    db.users.push(u);
    return u;
  };

  const me = mkUser('أحمد', '966500000001', true);
  db.currentUserId = me.id;

  // ─────────────── 1) جمعية الأصدقاء ───────────────
  const start = addDays(addMonths(today, -3), 3); // القسط القادم بعد 3 أيام بالضبط
  const friends: Circle = {
    id: uid('c_'),
    name: 'جمعية الأصدقاء',
    installment: 1000,
    currency: 'SAR',
    frequency: 'monthly',
    startDate: start,
    graceDays: 3,
    sharesCount: 10,
    rules:
      '١. يُدفع القسط خلال 3 أيام من موعده كحد أقصى.\n٢. يُرفع إثبات التحويل في التطبيق لكل دفعة.\n٣. من يستلم مبكراً يلتزم بالسداد حتى نهاية الجمعية، ويُفضّل وجود كفيل.\n٤. تبديل الأدوار بموافقة الطرفين والمنظم فقط.\n٥. لا فوائد ولا رسوم — الجمعية تعاون بين الأصدقاء.',
    organizerId: me.id,
    status: 'active',
    orderMethod: 'lottery',
    orderLocked: true,
    inviteCode: 'ASDQ25',
    postponements: [],
    createdAt: iso(addDays(start, -12)),
  };
  db.circles.push(friends);

  const people: { name: string; phone: string; app: boolean; method: Member['preferredPayment']; showPhone?: boolean; notes?: string; guarantor?: Member['guarantor'] }[] = [
    { name: 'فاطمة الزهراني', phone: '966500000011', app: true, method: 'bank', guarantor: { name: 'سعيد الزهراني', phone: '966500000091' } },
    { name: 'عبدالله القحطاني', phone: '966500000012', app: true, method: 'wallet', guarantor: { name: 'ماجد القحطاني', phone: '966500000092' } },
    { name: 'نورة السبيعي', phone: '966500000013', app: true, method: 'bank', showPhone: true },
    { name: 'أحمد', phone: me.phone, app: true, method: 'bank' },
    { name: 'خالد المطيري', phone: '966500000015', app: false, method: 'cash', notes: 'يفضل الدفع نقداً في نهاية الشهر' },
    { name: 'مريم العتيبي', phone: '966500000016', app: true, method: 'bank' },
    { name: 'يوسف الحربي', phone: '966500000017', app: true, method: 'wallet' },
    { name: 'هند الشهري', phone: '966500000018', app: true, method: 'bank', showPhone: true },
    { name: 'عمر الدوسري', phone: '966500000019', app: true, method: 'bank' },
    { name: 'ليلى الغامدي', phone: '966500000020', app: false, method: 'cash' },
  ];

  const users: Record<string, User> = {};
  const members: Member[] = people.map((p, i) => {
    const u = p.phone === me.phone ? me : p.app ? mkUser(p.name, p.phone, p.showPhone) : undefined;
    if (u) users[p.name] = u;
    return {
      id: uid('m_'),
      circleId: friends.id,
      userId: u?.id,
      name: p.name,
      phone: p.phone,
      role: p.phone === me.phone ? 'organizer' : 'member',
      preferredPayment: p.method,
      notes: p.notes,
      guarantor: p.guarantor,
      status: 'active',
      acceptedRulesAt: u ? iso(addDays(start, -10 + (i % 4))) : undefined,
      joinedAt: iso(addDays(start, -10 + (i % 4))),
    };
  });
  // يوسف مساعد المنظم
  members[6].role = 'assistant';
  db.members.push(...members);
  // القرعة حقيقية وقابلة للتحقق: نخلط معرفات الأسهم بالبذرة المعلنة، والعضو رقم i يأخذ السهم الذي وقع في الموضع i
  const LOTTERY_SEED = 482913;
  const shareIds = members.map(() => uid('s_')).sort();
  const drawn = seededShuffle(shareIds, LOTTERY_SEED);
  const shares: Share[] = members.map((m, i) => ({ id: drawn[i], circleId: friends.id, position: i + 1, holders: [{ memberId: m.id, fraction: 1 }] }));
  db.shares.push(...shares);
  const lotteryAt = iso(addDays(start, -5), 19);
  friends.lottery = { seed: LOTTERY_SEED, at: lotteryAt, byUserId: me.id, result: drawn };

  const log = (at: string, actor: User | undefined, type: string, msg: string) => appendLog(db, friends.id, actor?.id ?? me.id, type, msg, at);
  log(friends.createdAt, me, 'circle.create', `أنشأ الجمعية "${friends.name}": قسط 1000 SAR، 10 أسهم`);
  members.slice(1).forEach((m) => log(m.joinedAt, m.userId ? users[m.name] : me, m.userId ? 'member.join' : 'member.add', m.userId ? `انضم ${m.name} عبر كود الدعوة ووافق على قواعد الجمعية` : `أضاف العضو ${m.name} يدوياً (بلا تطبيق)`));
  log(iso(addDays(start, -6)), me, 'member.update', 'عيّن يوسف الحربي مساعداً للمنظم (تأكيد الدفعات فقط)');
  log(lotteryAt, me, 'order.lottery', `أجرى القرعة الإلكترونية (البذرة 482913) بحضور الأعضاء: ${members.map((m, i) => `${i + 1}-${m.name}`).join('، ')}`);
  log(iso(addDays(start, -4)), me, 'circle.start', 'بدأت الجمعية وقُفل ترتيب الاستلام');

  const sched = buildSchedule(friends);
  const pot = potAmount(friends);
  let receipt = 0;
  const pay = (m: Member, cycle: number, amount: number, paidAt: string, status: Payment['status'] = 'confirmed', withProof = true) => {
    const byStaff = m.preferredPayment === 'cash';
    const p: Payment = {
      id: uid('p_'),
      circleId: friends.id,
      cycleIndex: cycle,
      memberId: m.id,
      amount,
      method: m.preferredPayment ?? 'bank',
      status,
      proofImage: withProof && !byStaff ? proofSvg(m.name, amount, paidAt) : undefined,
      paidAt,
      submittedBy: byStaff ? me.id : (m.userId ?? me.id),
      submittedAt: iso(paidAt, 9),
      reviewedBy: status === 'confirmed' ? me.id : undefined,
      reviewedAt: status === 'confirmed' ? iso(paidAt, 21) : undefined,
      receiptNo: status === 'confirmed' ? `ASDQ25-${String(++receipt).padStart(4, '0')}` : undefined,
    };
    db.payments.push(p);
    const actor = m.userId ? Object.values(users).find((u) => u.id === m.userId) : me;
    if (byStaff) log(p.submittedAt, me, 'payment.record', `سجّل دفعة ${m.name} نقداً للدورة ${cycle + 1}: ${amount} SAR`);
    else {
      log(p.submittedAt, actor, 'payment.submit', `أعلن ${m.name} دفع ${amount} SAR للدورة ${cycle + 1} مع إثبات`);
      if (status === 'confirmed') log(p.reviewedAt!, me, 'payment.confirm', `أكّد دفعة ${m.name} (${amount}) للدورة ${cycle + 1}`);
    }
    return p;
  };
  const payout = (cycle: number, m: Member, confirmed: boolean) => {
    const at = addDays(sched[cycle].dueDate, 4);
    const o: Payout = {
      id: uid('o_'),
      circleId: friends.id,
      cycleIndex: cycle,
      shareId: shares[cycle].id,
      memberId: m.id,
      amount: pot,
      deliveredAt: iso(at, 18),
      deliveredBy: me.id,
      method: 'bank',
      recipientConfirmedAt: confirmed ? iso(at, 20) : undefined,
    };
    db.payouts.push(o);
    log(o.deliveredAt, me, 'payout.deliver', `سلّم ${pot} SAR إلى ${m.name} (دورة ${cycle + 1})`);
    if (confirmed) log(o.recipientConfirmedAt!, users[m.name], 'payout.confirm', `أكّد ${m.name} استلام ${pot}`);
  };

  // الدورات المنتهية 0..2
  const offsets = [[0, -1, 0, -2, 1, 0, 2, -1, 0, 1], [0, 0, -1, -1, 8, 1, 0, 0, 5, 2], [-1, 0, 0, -2, 99, 1, 0, -1, 2, 1]];
  for (let c = 0; c < 3; c++) {
    members.forEach((m, i) => {
      const off = offsets[c][i];
      if (off === 99) return; // خالد لم يدفع الدورة الثالثة
      pay(m, c, 1000, addDays(sched[c].dueDate, off));
    });
    payout(c, members[c], c < 2);
  }
  // خالد: دفعة جزئية للدورة الثالثة ثم توقف
  pay(members[4], 2, 300, addDays(sched[2].dueDate, 6));

  // الدورة الحالية (بعد 3 أيام): بعضهم دفع مبكراً
  pay(members[7], 3, 1000, addDays(today, -1)); // هند — مؤكدة
  pay(members[2], 3, 1000, addDays(today, -2)); // نورة — مؤكدة
  pay(members[5], 3, 1000, today, 'pending'); // مريم — بانتظار التأكيد
  pay(members[8], 3, 500, addDays(today, -1), 'pending'); // عمر — دفع جزئي بانتظار التأكيد

  // طلب تبديل: عمر (الدور 9) يريد التبديل مع مريم (الدور 6)، مريم وافقت، بانتظار المنظم
  db.swaps.push({
    id: uid('w_'),
    circleId: friends.id,
    fromShareId: shares[8].id,
    toShareId: shares[5].id,
    requestedBy: members[8].id,
    approvals: { from: iso(addDays(today, -2), 20), to: iso(addDays(today, -1), 11) },
    status: 'open',
    createdAt: iso(addDays(today, -2), 20),
    note: 'عندي مصاريف زواج أخي بعد 3 أشهر، أحتاج دوراً أبكر إن أمكن',
  });
  log(iso(addDays(today, -2), 20), users['عمر الدوسري'], 'swap.request', 'طلب تبديل الدور 9 (عمر الدوسري) مع الدور 6 (مريم العتيبي)');
  log(iso(addDays(today, -1), 11), users['مريم العتيبي'], 'swap.approve', 'وافقت مريم العتيبي على طلب تبديل الدورين 9 و6');

  // ─────────────── 2) جمعية العائلة (المستخدم عضو بنصف سهم) ───────────────
  const hind = users['هند الشهري'];
  const famStart = addDays(today, -7 * 5 + 2);
  const family: Circle = {
    id: uid('c_'),
    name: 'جمعية العائلة',
    installment: 250,
    currency: 'SAR',
    frequency: 'weekly',
    startDate: famStart,
    graceDays: 2,
    sharesCount: 8,
    rules: 'القسط كل خميس. نصف السهم مسموح للإخوة. من يتأخر أكثر من أسبوع يُبلغ الكبير في العائلة 😄',
    organizerId: hind.id,
    status: 'active',
    orderMethod: 'manual',
    orderLocked: true,
    inviteCode: 'FAM8W2',
    postponements: [],
    createdAt: iso(addDays(famStart, -6)),
  };
  db.circles.push(family);
  const saad = mkUser('سعد', '966500000031');
  const famPeople: [string, string, User | undefined][] = [
    ['هند الشهري', hind.phone, hind],
    ['أحمد', me.phone, me],
    ['سعد', saad.phone, saad],
    ['أم فيصل', '966500000032', undefined],
    ['فيصل', '966500000033', mkUser('فيصل', '966500000033')],
    ['ريم', '966500000034', mkUser('ريم', '966500000034')],
    ['بدر', '966500000035', undefined],
    ['لطيفة', '966500000036', mkUser('لطيفة', '966500000036')],
    ['منيرة', '966500000037', undefined],
  ];
  const fm: Member[] = famPeople.map(([name, phone, u], i) => ({
    id: uid('m_'),
    circleId: family.id,
    userId: u?.id,
    name,
    phone,
    role: i === 0 ? 'organizer' : 'member',
    status: 'active',
    preferredPayment: 'wallet',
    acceptedRulesAt: u ? iso(addDays(famStart, -5)) : undefined,
    joinedAt: iso(addDays(famStart, -5)),
  }));
  db.members.push(...fm);
  // ترتيب: هند، (أحمد+سعد نصف سهم)، أم فيصل، فيصل، ريم، بدر، لطيفة، منيرة
  const famShares: Share[] = [
    [fm[0]],
    [fm[3]],
    [fm[1], fm[2]],
    [fm[4]],
    [fm[5]],
    [fm[6]],
    [fm[7]],
    [fm[8]],
  ].map((hs, i) => ({ id: uid('s_'), circleId: family.id, position: i + 1, holders: hs.map((h) => ({ memberId: h.id, fraction: 1 / hs.length })) }));
  db.shares.push(...famShares);
  const famSched = buildSchedule(family);
  appendLog(db, family.id, hind.id, 'circle.create', 'أنشأت الجمعية "جمعية العائلة": قسط 250 SAR أسبوعياً، 8 أسهم', family.createdAt);
  appendLog(db, family.id, hind.id, 'order.manual', 'رتّبت الأدوار يدوياً بالاتفاق في اجتماع العائلة', iso(addDays(famStart, -3)));
  appendLog(db, family.id, hind.id, 'circle.start', 'بدأت الجمعية وقُفل ترتيب الاستلام', iso(addDays(famStart, -2)));
  famSched.forEach((cy) => {
    if (cy.dueDate > today) return;
    fm.forEach((m, i) => {
      const units = famShares.reduce((a, s) => a + (s.holders.find((h) => h.memberId === m.id)?.fraction ?? 0), 0);
      if (i === 6 && cy.index === famSched.filter((x) => x.dueDate <= today).length - 1) return;
      const amount = 250 * units;
      const at = addDays(cy.dueDate, i % 3 === 0 ? 0 : -1);
      db.payments.push({
        id: uid('p_'), circleId: family.id, cycleIndex: cy.index, memberId: m.id, amount, method: 'wallet', status: 'confirmed', paidAt: at,
        submittedBy: m.userId ?? hind.id, submittedAt: iso(at), reviewedBy: hind.id, reviewedAt: iso(at, 20), receiptNo: `FAM8W2-${String(db.payments.length + 1).padStart(4, '0')}`,
        proofImage: m.userId ? proofSvg(m.name, amount, at) : undefined,
      });
    });
    const s = famShares[cy.index];
    if (addDays(cy.dueDate, 1) <= today)
      s.holders.forEach((h) =>
        db.payouts.push({
          id: uid('o_'), circleId: family.id, cycleIndex: cy.index, shareId: s.id, memberId: h.memberId, amount: 2000 * h.fraction,
          deliveredAt: iso(addDays(cy.dueDate, 1)), deliveredBy: hind.id, method: 'wallet', recipientConfirmedAt: iso(addDays(cy.dueDate, 1), 21),
        }),
      );
  });
  appendLog(db, family.id, hind.id, 'payout.deliver', 'سلّمت 1000 SAR لكل من أحمد وسعد (نصف سهم لكل منهما)', iso(addDays(famSched[2].dueDate, 1)));

  // ─────────────── 3) جمعية الزملاء 2025 (مكتملة) ───────────────
  const pastStart = addMonths(today, -13);
  const past: Circle = {
    id: uid('c_'), name: 'جمعية الزملاء 2025', installment: 500, currency: 'SAR', frequency: 'monthly', startDate: pastStart, graceDays: 3, sharesCount: 4,
    rules: 'جمعية زملاء العمل.', organizerId: users['نورة السبيعي'].id, status: 'completed', orderMethod: 'lottery', orderLocked: true, inviteCode: 'ZML25X', postponements: [],
    createdAt: iso(addDays(pastStart, -7)),
  };
  db.circles.push(past);
  const pm: Member[] = [users['نورة السبيعي'], me, users['عمر الدوسري'], users['فاطمة الزهراني']].map((u, i) => ({
    id: uid('m_'), circleId: past.id, userId: u.id, name: u.name, phone: u.phone, role: i === 0 ? 'organizer' : 'member', status: 'active', joinedAt: iso(addDays(pastStart, -6)), acceptedRulesAt: iso(addDays(pastStart, -6)),
  }));
  db.members.push(...pm);
  const ps: Share[] = pm.map((m, i) => ({ id: uid('s_'), circleId: past.id, position: i + 1, holders: [{ memberId: m.id, fraction: 1 }] }));
  db.shares.push(...ps);
  appendLog(db, past.id, users['نورة السبيعي'].id, 'circle.create', 'أنشأت الجمعية "جمعية الزملاء 2025"', past.createdAt);
  buildSchedule(past).forEach((cy) => {
    pm.forEach((m) =>
      db.payments.push({
        id: uid('p_'), circleId: past.id, cycleIndex: cy.index, memberId: m.id, amount: 500, method: 'bank', status: 'confirmed', paidAt: cy.dueDate,
        submittedBy: m.userId!, submittedAt: iso(cy.dueDate), reviewedBy: past.organizerId, reviewedAt: iso(cy.dueDate, 20), receiptNo: `ZML25X-${cy.index}${m.name.length}`,
      }),
    );
    db.payouts.push({ id: uid('o_'), circleId: past.id, cycleIndex: cy.index, shareId: ps[cy.index].id, memberId: pm[cy.index].id, amount: 2000, deliveredAt: iso(addDays(cy.dueDate, 2)), deliveredBy: past.organizerId, method: 'bank', recipientConfirmedAt: iso(addDays(cy.dueDate, 2)) });
  });
  appendLog(db, past.id, users['نورة السبيعي'].id, 'circle.complete', 'اكتملت الجمعية واستلم الجميع 🎉', iso(addDays(buildSchedule(past)[3].dueDate, 3)));

  db.log.sort((a, b) => a.at.localeCompare(b.at));
  // بعد الترتيب الزمني نعيد بناء السلسلة لكل جمعية
  const rebuilt: DB['log'] = [];
  const tmp: DB = { ...db, log: rebuilt };
  for (const e of db.log) appendLog(tmp, e.circleId, e.actorId, e.type, e.message, e.at);
  db.log = tmp.log;
  return db;
}
