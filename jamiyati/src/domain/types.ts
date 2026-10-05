// نموذج البيانات — يطابق جداول قاعدة البيانات في supabase/schema.sql
// كل التواريخ بصيغة ISO "YYYY-MM-DD" (تواريخ تقويمية بلا توقيت) أو ISO كامل للطوابع الزمنية.

export type Frequency = 'weekly' | 'biweekly' | 'monthly';
export type CircleStatus = 'draft' | 'active' | 'completed' | 'terminated';
export type OrderMethod = 'manual' | 'lottery' | 'requests';
export type Role = 'organizer' | 'assistant' | 'member';
export type PaymentMethod = 'bank' | 'wallet' | 'cash' | 'other';

export interface User {
  id: string;
  name: string;
  phone: string; // E.164 بدون +، مثل 9665xxxxxxxx
  preferredPayment?: PaymentMethod;
  shareReputation: boolean; // موافقة على عرض مؤشر الالتزام للمنظمين
  showPhone: boolean; // السماح بعرض الجوال لأعضاء جمعياته
  createdAt: string;
}

export interface Circle {
  id: string;
  name: string;
  installment: number; // قسط السهم الكامل في كل دورة
  currency: string; // SAR, EGP, KWD, ...
  frequency: Frequency;
  startDate: string; // تاريخ استحقاق الدورة الأولى
  graceDays: number;
  sharesCount: number;
  rules: string;
  organizerId: string;
  status: CircleStatus;
  orderMethod: OrderMethod;
  orderLocked: boolean;
  inviteCode: string;
  /** فهارس الدورات التي أُجّلت قبلها دورة كاملة (مثلاً رمضان). كل عنصر يزيح الدورة وما بعدها فترة واحدة. */
  postponements: Postponement[];
  lottery?: LotteryRecord;
  terminatedAt?: string;
  /** organized = أنا المنظِّم وأدير الجميع، personal = أنا عضو أتابع أقساطي ودوري في جمعية يديرها غيري */
  mode?: 'organized' | 'personal';
  organizerName?: string;
  organizerPhone?: string;
  createdAt: string;
}

export interface Postponement {
  beforeCycle: number; // فهرس الدورة (يبدأ من 0) التي تُزاح هي وما بعدها
  reason: string;
  at: string;
}

export interface LotteryRecord {
  seed: number;
  at: string;
  byUserId: string;
  /** ترتيب معرفات الأسهم الناتج */
  result: string[];
}

export interface Member {
  id: string;
  circleId: string;
  userId?: string; // فارغ للعضو المضاف يدوياً بلا تطبيق
  name: string;
  phone: string;
  role: Role;
  preferredPayment?: PaymentMethod;
  notes?: string;
  guarantor?: { name: string; phone: string };
  acceptedRulesAt?: string;
  status: 'active' | 'withdrawn';
  /** العضو البديل يرث أسهم المنسحب */
  replacesMemberId?: string;
  withdrawnAt?: string;
  joinedAt: string;
}

/** السهم = دور واحد في الاستلام. قد يملكه عضو واحد أو يتشاركه عضوان (نصف سهم). */
export interface Share {
  id: string;
  circleId: string;
  position: number; // ترتيب الاستلام (1..N)، 0 = لم يُحدد بعد
  holders: ShareHolder[];
  requestedAt?: string; // لطريقة "أولوية الطلب"
  requestedPosition?: number;
}

export interface ShareHolder {
  memberId: string;
  fraction: number; // 1 أو 0.5
}

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected' | 'voided';

export interface Payment {
  id: string;
  circleId: string;
  cycleIndex: number;
  memberId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  proofImage?: string; // data URL مضغوط محلياً، أو مسار تخزين في الإنتاج
  note?: string;
  paidAt: string; // تاريخ الدفع الفعلي كما أعلنه الدافع
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  voidReason?: string;
  receiptNo?: string;
}

export interface Payout {
  id: string;
  circleId: string;
  cycleIndex: number;
  shareId: string;
  memberId: string; // المستلم (في نصف السهم: سجل لكل شريك)
  amount: number;
  deliveredAt: string;
  deliveredBy: string;
  method: PaymentMethod;
  recipientConfirmedAt?: string;
}

export interface SwapRequest {
  id: string;
  circleId: string;
  fromShareId: string;
  toShareId: string;
  requestedBy: string; // memberId
  approvals: { from?: string; to?: string; organizer?: string }; // طوابع زمنية
  status: 'open' | 'done' | 'rejected';
  createdAt: string;
  note?: string;
}

export interface ActivityEntry {
  id: string;
  circleId: string;
  at: string;
  actorId: string;
  actorName: string;
  type: string;
  message: string;
  /** سلسلة تجزئة: كل قيد يحمل تجزئة القيد السابق لاكتشاف أي تلاعب */
  prevHash: string;
  hash: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  circleId?: string;
  at: string;
  kind: 'reminder' | 'proof' | 'turn' | 'summary' | 'swap' | 'info';
  text: string;
  read: boolean;
  key?: string; // لمنع تكرار التذكير نفسه
}

export interface Settings {
  lang: 'ar' | 'en';
  theme: 'system' | 'light' | 'dark';
  calendar: 'gregory' | 'islamic' | 'both';
  digits: 'latn' | 'arab';
  fontScale: number; // 1 = عادي
  pinHash?: string;
  biometricId?: string;
  premium: boolean;
  onboarded: boolean;
}

export interface DB {
  version: number;
  users: User[];
  circles: Circle[];
  members: Member[];
  shares: Share[];
  payments: Payment[];
  payouts: Payout[];
  swaps: SwapRequest[];
  log: ActivityEntry[];
  notifications: AppNotification[];
  currentUserId?: string;
  settings: Settings;
}
