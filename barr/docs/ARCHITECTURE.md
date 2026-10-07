# برّ (Barr) — المرحلة 1: الهيكل ونموذج البيانات

> التطبيق داخل المجلد `barr/` لأن المستودع يحتوي ملفات أخرى غير مرتبطة.

## 1. هيكل المجلدات (Feature-first + Clean Architecture)

```
barr/
├── android/  ios/                     # flavors: dev / prod (productFlavors + Xcode schemes)
├── assets/{fonts/IBMPlexSansArabic, images, sounds/(alarm.mp3, sos.mp3), lottie}
├── l10n/{app_ar.arb, app_en.arb}
├── firebase/
│   ├── firestore.rules  firestore.indexes.json  storage.rules
│   └── functions/ (TypeScript)
│       └── src/{index.ts, auth/, family/, linking/, alerts/, sos/, reports/, billing/, scheduled/}
├── lib/
│   ├── main_dev.dart  main_prod.dart  bootstrap.dart  app.dart
│   ├── core/
│   │   ├── config/        # FlavorConfig, Remote Config keys
│   │   ├── constants/     # limits (free plan), durations, channel ids
│   │   ├── error/         # Failure (sealed), AppException, error→Arabic message mapper
│   │   ├── network/       # ConnectivityService
│   │   ├── router/        # go_router + guards (auth / role / onboarding / app-lock)
│   │   ├── theme/         # caregiver_theme (M3 light/dark), elder_theme (high contrast, ≥24sp)
│   │   ├── l10n/          # generated
│   │   ├── services/      # notifications, alarm, tts, permissions, biometrics, crypto, analytics
│   │   ├── utils/  extensions/
│   │   └── widgets/       # BigButton, Skeleton, EmptyState, ErrorView, PermissionRationaleSheet
│   ├── shared/
│   │   ├── data/firestore_paths.dart  converters/
│   │   └── domain/entities/  (AppUser, Family, Member, Elder) + enums (AccountType, FamilyRole)
│   └── features/
│       ├── onboarding/        # 3 شاشات عاطفية
│       ├── auth/              # phone → OTP → account type → profile
│       ├── family/            # create circle, invite siblings, roles, manage elders
│       ├── elder_linking/     # QR / 6-digit code / Setup Mode
│       ├── elder_home/        # (م2) الأزرار الأربعة
│       ├── medications/       # (م2)
│       ├── checkin/           # (م2)
│       ├── caregiver_dashboard/ alerts/ sos/            # (م3)
│       ├── health/ appointments/ medical_profile/ reports/  # (م4)
│       ├── coordination/ (tasks, visits, chat, activity, expenses)  # (م5)
│       ├── subscription/ voice_messages/ ocr/ widget/   # (م6)
│       └── settings/          # app lock, notifications prefs, delete account
│           # كل feature:
│           #   data/{datasources, models (freezed+json), repositories_impl}
│           #   domain/{entities, repositories (abstract), usecases}
│           #   presentation/{providers (Riverpod), screens, widgets}
└── test/  (mirrors lib/)   integration_test/
```

**الحزم الأساسية:** flutter_riverpod + riverpod_generator, go_router, freezed/json_serializable,
firebase_* , flutter_local_notifications, android_alarm_manager_plus, flutter_tts,
mobile_scanner + qr_flutter, local_auth, permission_handler, geolocator, purchases_flutter,
connectivity_plus, cached_network_image, mocktail.

## 2. نموذج Firestore

القاعدة: **كل البيانات الصحية تحت `families/{familyId}`** حتى تكون قواعد الأمان بسيطة:
«هل أنت عضو في هذه العائلة؟».

```
users/{uid}
  phone, displayName, photoUrl, accountType: 'caregiver'|'elder'
  locale: 'ar'|'en', familyIds: [fid]          # للعرض فقط، ليست مصدر الصلاحية
  elderRef?: {familyId, elderId}               # إن كان الحساب لوالد
  createdAt, lastActiveAt
  └─ devices/{deviceId}  fcmToken, platform, appVersion, updatedAt

families/{fid}
  name, ownerUid, createdAt
  plan: 'free'|'premium'|'trial', planExpiresAt   # تكتبه Cloud Functions فقط
  limits: {maxElders, maxMeds, maxMembers}         # تكتبه Functions (من Remote Config)
  counts: {elders, members, medications}           # تحدّثه triggers فقط
  │
  ├─ members/{uid}                                 # ← مصدر الصلاحية الوحيد
  │    role: 'admin'|'caregiver'|'viewer'|'elder'
  │    displayName, photoUrl, phone, relation ('ابن','ابنة',...)
  │    notificationPrefs: {sos, missedDose, checkin, dailySummary, inactivity, quietHours}
  │    joinedAt
  │
  ├─ invites/{inviteId}                            # دعوة الإخوة
  │    phone, role, createdBy, status, expiresAt
  │
  ├─ elders/{eid}
  │    name, nickname ('بابا'), photoUrl, birthYear, gender
  │    linkedUid?: uid  linkStatus: 'pending'|'linked'
  │    timezone, checkinDeadline: '10:00', inactivityHours?: 12
  │    emergencyContacts: [{name, phone, order}]
  │    features: {prayerTimes, adhkar, voiceCommands}
  │    status: {level: 'green'|'yellow'|'red', reason, updatedAt}   # تحسبه Functions
  │    lastActivityAt, lastCheckinAt
  │    │
  │    ├─ medications/{mid}         (م2) name, photoPath, dose, form, schedule{times[], days[]},
  │    │                            startDate, endDate?, instructions, stock{qty, perDose, alertAt}, active
  │    ├─ doseLogs/{yyyyMMdd_mid_HHmm} (م2) medId, scheduledAt, status 'taken'|'snoozed'|'missed',
  │    │                            actedAt, source 'elder'|'caregiver', snoozeCount
  │    ├─ checkins/{yyyyMMdd}       (م2) at, source 'button'|'widget'|'voice'
  │    ├─ sosEvents/{id}            (م3) at, location{lat,lng,accuracy}, status, acknowledgedBy[]
  │    ├─ vitals/{id}               (م4) type, value{...}, unit, measuredAt, isAbnormal, enc?
  │    ├─ appointments/{id}         (م4) title, doctor, place, at, escortUid, attachments[]
  │    └─ private/medicalProfile    (م4) حقول مشفّرة: chronic, allergies, bloodType, surgeries, insurance
  │
  ├─ timeline/{id}     # سجل النشاط + الخط الزمني: type, elderId?, actorUid, payload, at
  ├─ alerts/{id}       # type, severity, elderId, status 'open'|'ack'|'resolved', createdAt
  ├─ tasks/ visits/ expenses/ chat/{msgId}  voiceMessages/   (م5–6)

linkCodes/{code}         # 6 أرقام، صلاحية 15 دقيقة، استخدام مرة واحدة
  familyId, elderId, createdBy, expiresAt, usedAt?      # قراءة/كتابة عبر Functions فقط

subscriptions/{fid}      # من RevenueCat webhook — Functions فقط
```

### ربط جهاز الوالد (بدون OTP على جهازه)
1. الابن ينشئ `elder` → Function `createLinkCode` تُرجع كود 6 أرقام + QR يحمل نفس الكود.
2. جهاز الوالد يُدخل الكود/يمسح QR → Function `redeemLinkCode`:
   تنشئ مستخدم Auth للوالد، تضيفه `members/{uid}` بدور `elder`، تربط `elders/{eid}.linkedUid`،
   تُرجع **Custom Token** → `signInWithCustomToken`. الجلسة دائمة ولا تحتاج إعادة تسجيل.
3. **Setup Mode:** نفس المسار، لكن الابن يفتح التطبيق على جهاز الوالد ويختار «تجهيز جهاز والدي»
   ثم يسجّل بحسابه لتوليد الكود ويُكمل الإعدادات والصلاحيات، ثم يُسلّم الجهاز مقفلًا.
- الوالد يمكنه أيضًا التسجيل برقمه + OTP ثم إدخال الكود (للمستخدم المتمكن).

### قواعد الأمان (الخلاصة)
- `isMember(fid)` = `exists(/families/fid/members/uid)`، و`role(fid)` يُقرأ من نفس المستند.
- viewer: قراءة فقط. caregiver: كتابة البيانات الصحية والمهام. admin: إدارة الأعضاء والإعدادات.
- elder: قراءة بياناته فقط، والكتابة محصورة في `doseLogs` و`checkins` و`sosEvents`
  و`voiceMessages` لنفس `eid`، بحقول محددة (`affectedKeys().hasOnly`). لا يعدّل إعدادات.
- `plan`, `limits`, `counts`, `status`, `linkCodes`, `subscriptions`: كتابة من Admin SDK فقط.
- حدود الخطة المجانية تُفرض في القواعد: إنشاء دواء مسموح فقط إن `counts.medications < limits.maxMeds`
  (+ trigger يتحقق ويحذف التجاوز في حالة السباق).
- Storage: `families/{fid}/...` بنفس شرط العضوية، صور ≤ 5MB، أنواع محددة.

### التشفير
- Firestore مشفّر at-rest افتراضيًا. الحقول الطبية الحساسة (`medicalProfile`، ملاحظات القياسات)
  تُشفّر إضافيًا AES-GCM بمفتاح عائلة (DEK) مغلّف بـ Cloud KMS، ويُفك عبر Function للأعضاء فقط،
  ويُخزّن المفتاح على الجهاز في `flutter_secure_storage`.

### Offline
- Firestore persistence مفعّل. جدولة تذكيرات الدواء محليًا على جهاز الوالد من `medications`
  (تُعاد عند كل تغيير وعند الإقلاع وبعد إعادة التشغيل `BOOT_COMPLETED`)،
  و`doseLogs` بمعرّف حتمي ⇒ لا تكرار عند المزامنة.

## 3. Cloud Functions للمرحلة 1
`onUserCreate`, `createFamily` (ينشئ family + member admin ذريًا), `inviteMember`, `acceptInvite`,
`createLinkCode`, `redeemLinkCode`, `onMemberWrite` (تحديث counts/familyIds), `deleteAccount`.

## 4. نطاق المرحلة 1 (بعد موافقتك)
مشروع Flutter + flavors + الثيمات + l10n + Onboarding + Auth (OTP) + اختيار نوع الحساب
+ إنشاء العائلة ودعوة الإخوة + إضافة والد وربطه (كود/QR/Setup Mode) + Functions أعلاه
+ Security Rules + اختبارات Unit/Widget/Rules (emulator).
