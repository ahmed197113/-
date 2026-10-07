# برّ (Barr)

تطبيق Flutter لمتابعة رعاية الوالدين كبار السن عن بُعد. التصميم الكامل في `docs/ARCHITECTURE.md`.

## تحميل APK
كل دفع (push) إلى الفرع يبني نسخة تلقائيًا عبر GitHub Actions، وتُنشر في
**Releases → `barr-dev-latest`** باسم `barr-dev.apk`.

## وضع التجربة (Demo)
عند عدم توفر إعدادات Firebase يعمل التطبيق محليًا على الجهاز:
- رمز التحقق دائمًا `123456`.
- البيانات محفوظة على الجهاز فقط.
- «تجهيز هذا الجوال لوالدي» يحوّل الجوال نفسه لواجهة الوالد.
- للخروج من واجهة الوالد: اضغط على عبارة الترحيب 7 مرات.

## ربط Firebase
1. أنشئ مشروعين `barr-dev` و`barr-prod`، وفعّل Phone Auth وFirestore وFunctions (منطقة `me-central2`).
2. انسخ `env/example.json` إلى `env/dev.json` واملأ القيم من إعدادات المشروع.
3. أضف بصمات SHA-1/SHA-256 لتطبيق Android في Firebase (لازمة لـ Phone Auth).
4. انشر القواعد والدوال:
   ```bash
   cd firebase && npm --prefix functions install
   firebase deploy --only firestore,storage,functions
   ```
5. لبناء GitHub Actions مع Firebase: أضف محتوى `env/dev.json` كـ secret باسم `BARR_ENV_DEV`.

## التشغيل محليًا
```bash
flutter run --flavor dev -t lib/main_dev.dart --dart-define-from-file=env/dev.json
flutter test
```

## الهيكل
`lib/core` (إعدادات، أخطاء، ثيمات، توجيه) · `lib/shared` (الكيانات) ·
`lib/features/<feature>/{domain,data,presentation}` · `firebase/` (القواعد والدوال).
كل مستودع (Repository) له تنفيذان: Firebase ومحلي (Demo)، ويُختار تلقائيًا.
