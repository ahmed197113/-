# تفعيل تسجيل الدخول بحساب Google (اختياري) — نبضٌ صغير 1.2

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
| Personal info ← **Name** | Yes | No | Optional (الحساب اختياري) | Account management, App functionality |
| Personal info ← **Email address** | Yes | No | Optional | Account management |
| Personal info ← **User IDs** (معرّف Google + معرّف الجهاز العشوائي) | Yes | No | Optional للحساب / Required لمعرّف الجهاز | Account management, App functionality, Fraud prevention, security, and compliance |
| Health and fitness ← **Health info** (نسخة بيانات الحمل في النسخ الاحتياطي، وأسئلة المساعد) | Yes | No | Optional | App functionality |
| App activity ← **Other user-generated content** (أسئلة وردود المجتمع) | Yes | No | Optional | App functionality |
| **App info and performance** | No | — | — | — |

- كل البيانات **Processed ephemerally: No** للنسخة والحساب (محفوظة لحد ما المستخدمة تحذفها)، و**Yes** لأسئلة المساعد (مش بنحفظها).
- **Shared:** No في كل الأنواع (Gemini بيعالج الأسئلة كمزوّد خدمة بالنيابة عننا، وده مش بيتحسب "مشاركة" في تعريف Google).
