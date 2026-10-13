# تفعيل تسجيل الدخول (اختياري) — نبضٌ صغير 1.2

> ## تحديث 1.2.48 — سبب قفل قائمة Google بدون رسالة (اتصلّح)
> ملف `nabd.apk` على GitHub كان بيتوقّع ببصمة **CD:0C:1A:D8:FB:68:FA:05:76:AE:39:74:D8:C4:65:A9:63:30:DF:85** مش **D5:F7…2F:37**
> (البناء كان بيتجاهل `nabd-debug.keystore`). من 1.2.48 التوقيع بقى صريح في `build.gradle`، والبناء بيطبع البصمة ويقف لو مش D5:F7.
> - **مرة واحدة بس:** امسحي نسخة الـ APK القديمة من الموبايل قبل تثبيت 1.2.48 (اختلاف التوقيع بيمنع التحديث فوقها). نسخ Google Play مش متأثرة.
> - `serverClientId` = `default_web_client_id` من `google-services.json` (client_type 3) = `987831438755-a2c3…`، والبناء بيتأكد منه.
> - أي فشل في الدخول بيظهر في نافذة فيها الخطوات ونوع الخطأ والكود (مثلاً `ApiException statusCode=10 DEVELOPER_ERROR` = بصمة أو Web client غلط)، ويتبعت لـ Crashlytics.
> - **فيسبوك:** التطبيق لسه في وضع Development، فالدخول بيشتغل لحسابات المسؤولين والمختبرين بس. لازم يتحوّل لـ **Live** قبل النشر للعامة.


> **تحديث:** تطبيق أندرويد بقى بيسجّل الدخول عبر **Firebase** (مشروع `nabd-saghir`) بـ **Google** و**Facebook**.
> نسخة المتصفح بتفضل بزر Google العادي. السيرفر بيتحقق من الاتنين، وحساب Google واحد سواء دخلتِ من التطبيق أو من المتصفح.
>
> **المطلوب لتفعيله في التطبيق:**
> 1. ملف `google-services.json` (Firebase ← Project settings ← Your apps ← Nabd Saghir Android): يا إما يتحط في `pregnancy-app/android-app/google-services.json`، يا إما في GitHub ← Settings ← Secrets ← Actions ← `NABD_GOOGLE_SERVICES_JSON` (المحتوى كله). من غيره البناء بيقفل تسجيل الدخول تلقائياً.
> 2. Firebase ← Authentication ← Sign-in method: فعّل **Google**، وفعّل **Facebook** بالـ App ID و**App Secret** من فيسبوك.
> 3. انسخ **OAuth redirect URI** اللي Firebase بيعرضها في إعداد Facebook (`https://nabd-saghir.firebaseapp.com/__/auth/handler`) وحطها في Facebook ← Facebook Login ← Settings ← Valid OAuth Redirect URIs.
> 4. Facebook ← App settings ← Basic: Privacy Policy URL = `https://nabd.khatta.net/privacy.html` و User data deletion = `https://nabd.khatta.net/delete-account.html`، وبعدين حوّل التطبيق لـ **Live**.
> 5. في `config.php` على السيرفر: `'firebase_project_id' => 'nabd-saghir',`
> 6. تسجيل الدخول بيظهر في التطبيق بعد ما `apiBase` يتحط في `config.js` (رابط السيرفر).
>
> الخطوات تحت (Google Cloud) لسه مهمة لزر المتصفح، وبصمات SHA-1 لازم تكون في Firebase (اتعملت).

تسجيل الدخول اختياري تماماً. لو ما اتفعّلش، التطبيق بيشتغل عادي، وزرار «لديّ حساب» وصفحة «حسابي» مش بيظهروا.

## 1) مشروع Google Cloud
1. ادخل على https://console.cloud.google.com وأنشئ مشروعاً باسم `Nabd` (أو استخدم مشروع Gemini نفسه).
2. **Google Auth Platform ← Branding (OAuth consent screen):**
   - App name: `نبضٌ صغير` · User support email: بريدك.
   - App domain: `https://nabd.khatta.net` · Privacy policy: `https://nabd.khatta.net/privacy.html`.
   - Authorized domains: `khatta.net`.
3. **Audience:** External، واتركه **Testing** في البداية وأضف إيميلات المختبرين في Test users. لما تجهز اضغط **Publish app** (النطاقات `email` و`profile` بس، ومش محتاجة مراجعة من Google).
4. **Data Access (Scopes):** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` بس.

## 2) Web client (مطلوب للويب وللأندرويد)
**Clients ← Create client ← Web application**
- Name: `Nabd Web`
- Authorized JavaScript origins: `https://nabd.khatta.net` (ولو هتجرّب محلياً ضيف `http://localhost:8080`).
- انسخ **Client ID** (بينتهي بـ `.apps.googleusercontent.com`) وحطّه في مكانين:
  - `pregnancy-app/config.js` ← `googleWebClientId`
  - `nabd-api/config.php` على السيرفر ← `google_client_ids`

> Client ID مش سرّ ومسموح يكون جوه التطبيق. **ما تستخدمش Client secret** في أي مكان.

## 3) Android clients (واحد لكل مفتاح توقيع)
**Clients ← Create client ← Android**، والـ Package name في كلهم: `app.nabd.pregnancy`

| الاسم | SHA-1 | منين |
|---|---|---|
| Nabd Play | SHA-1 بتاع **App signing key** | Play Console ← التطبيق ← Test and release ← **App integrity** ← App signing |
| Nabd Upload | SHA-1 بتاع **Upload key** | نفس الصفحة (لو هتجرّب AAB موقّع بمفتاحك قبل رفعه) |
| Nabd APK (للتجربة) | `D5:F7:A1:A1:3F:4C:1D:CA:4C:62:36:D8:1D:84:B9:82:7B:59:2F:37` | مفتاح `nabd.apk` اللي على GitHub |

> الأندرويد بيبعت **Web client ID** نفسه (مش Android client ID). كلاينتات الأندرويد بس بتثبت إن التطبيق الموقّع مسموح له.

## 4) السيرفر
1. phpMyAdmin ← القاعدة ← Import ← ارفع `api/schema.sql` تاني (آمن: الجداول الموجودة مش بتتغير، وبيضيف `users`, `sessions`, `backups`, `user_devices`, `delete_requests`).
2. ارفع الملفات الجديدة في `nabd-api`: `auth.php`, `backup.php`, `account.php`، والملفات المعدّلة: `lib.php`, `community.php`, `admin.php`, `.htaccess`.
3. ارفع `delete-account.html` و`privacy.html` في `public_html`.
4. في `config.php` ضيف:
   ```php
   'google_client_ids' => ['WEB_CLIENT_ID.apps.googleusercontent.com'],
   'auth_daily_ip' => 40,
   'backup_daily'  => 400,
   ```
   **ما تضيفش `test_mode` على السيرفر الحقيقي** (وهو كده كده مش بيشتغل غير مع `php -S` المحلي).

## 5) Google Play Console
- **App content ← Data safety:** حدّثها بالإجابات اللي تحت.
- **App content ← Data deletion:** رابط حذف الحساب `https://nabd.khatta.net/delete-account.html`.
- **App access:** "All functionality is available without special access" (الدخول اختياري).

## إجابات Data safety المحدّثة
**Does your app collect or share any of the required user data types?** Yes
**Is all of the user data collected by your app encrypted in transit?** Yes
**Do you provide a way for users to request that their data is deleted?** Yes (in-app + `delete-account.html`)

| نوع البيانات | Collected | Shared | Optional | الغرض |
|---|---|---|---|---|
| Personal info ← **Name** | Yes | No | Optional (الحساب اختياري، بـ Google أو Facebook) | Account management, App functionality |
| Personal info ← **Email address** | Yes | No | Optional | Account management |
| Personal info ← **User IDs** (معرّف Google + معرّف الجهاز العشوائي) | Yes | No | Optional للحساب / Required لمعرّف الجهاز | Account management, App functionality, Fraud prevention, security, and compliance |
| Health and fitness ← **Health info** (نسخة بيانات الحمل في النسخ الاحتياطي، وأسئلة المساعد) | Yes | No | Optional | App functionality |
| App activity ← **Other user-generated content** (أسئلة وردود المجتمع) | Yes | No | Optional | App functionality |
| App info and performance ← **Crash logs** | Yes | No | Optional (يمكن إيقافها من الإعدادات) | App functionality, Analytics |
| App info and performance ← **Diagnostics** | Yes | No | Optional | App functionality, Analytics |
| Device or other IDs (Firebase installation ID لـ Crashlytics) | Yes | No | Optional | App functionality, Analytics |

- كل البيانات **Processed ephemerally: No** للنسخة والحساب (محفوظة لحد ما المستخدمة تحذفها)، و**Yes** لأسئلة المساعد (مش بنحفظها).
- Crashlytics: بدون معرّف الإعلانات وبدون بيانات صحية في التقارير، وتُحذف بعد 90 يوماً.
- Facebook SDK مضبوط بدون تتبّع (AutoLogAppEvents وAdvertiserID مقفولين، وإذن AD_ID متشال)، فـ **Advertising ID: No** و**App interactions: No**.
- **Shared:** No في كل الأنواع (Gemini بيعالج الأسئلة كمزوّد خدمة بالنيابة عننا، وده مش بيتحسب "مشاركة" في تعريف Google).
