# التوقيع والبناء والنشر

## المفاتيح باختصار

| المفتاح | أين هو | الحالة |
|---|---|---|
| مفتاح «وَفْر» القديم (`wafr-app/app/signing/wafr-release.p12`) | كان في المستودع العام، مع كلمة مروره داخل `build.gradle.kts` | **مكشوف**: حُذف من المستودع ولن يُستخدم مع Play |
| **مفتاح الرفع الجديد (upload key)** | على جهازك فقط: `C:\Users\ahmed\Wafr-Upload-Key\` | يوقّع ملف AAB قبل رفعه إلى Play |
| مفتاح توقيع التطبيق (app signing key) | تنشئه Google وتحفظه عبر **Play App Signing** | لا تملكه، ولا تستطيع خسارته |

## 1. أضف مفتاح الرفع إلى GitHub Secrets (مرة واحدة)

1. افتح `C:\Users\ahmed\Wafr-Upload-Key\README-SECRETS.txt`. فيه القيم كلها.
2. في GitHub افتح المستودع `ahmed197113/-` ← **Settings** ← **Secrets and variables** ← **Actions** ← **New repository secret**.
3. أضف هذه الأسرار الأربعة بأسمائها حرفياً:

   | الاسم | القيمة |
   |---|---|
   | `SIGNING_KEYSTORE_BASE64` | محتوى الملف `SIGNING_KEYSTORE_BASE64.txt` كاملاً، وهو سطر واحد طويل |
   | `SIGNING_KEY_ALIAS` | `haseef-upload` |
   | `SIGNING_STORE_PASSWORD` | كلمة المرور الموجودة في `README-SECRETS.txt` |
   | `SIGNING_KEY_PASSWORD` | كلمة المرور نفسها |

4. شغّل workflow **«Wafr Android build»** من تبويب Actions (Run workflow)، أو ادفع أي تعديل.
5. في سجل التشغيل، خطوة **«Show signing certificate»**: يجب أن يظهر `signed-with-upload-key=true`، وأن تطابق بصمة SHA-256 الظاهرة البصمة المكتوبة في `README-SECRETS.txt`.

**بديل بسطر واحد،** بعد تسجيل الدخول في `gh`، من داخل مجلد المفتاح. استبدل `***` بكلمة المرور:

```powershell
gh secret set SIGNING_KEYSTORE_BASE64 -R ahmed197113/- -b (Get-Content .\SIGNING_KEYSTORE_BASE64.txt -Raw); gh secret set SIGNING_KEY_ALIAS -R ahmed197113/- -b haseef-upload; gh secret set SIGNING_STORE_PASSWORD -R ahmed197113/- -b "***"; gh secret set SIGNING_KEY_PASSWORD -R ahmed197113/- -b "***"
```

**احفظ مجلد المفتاح في مكانين:** مدير كلمات مرور، ونسخة غير متصلة بالإنترنت. لو فقدته، تستطيع مع Play App Signing طلب «إعادة تعيين مفتاح الرفع» من Play Console. لكن لا تعتمد على ذلك.

## 2. نظّف تاريخ المستودع من المفتاح القديم (موصى به)

حذف الملف في commit جديد لا يزيله من التاريخ. ولأن المستودع عام، **اعتبر المفتاح القديم مكشوفاً إلى الأبد**، ولهذا أنشأت مفتاحاً جديداً ومعرّف حزمة جديداً. التنظيف إجراء نظافة فقط، ويعيد كتابة التاريخ:

```bash
pip install git-filter-repo
```

```bash
git clone --mirror https://github.com/ahmed197113/-.git repo-mirror
```

```bash
cd repo-mirror && git filter-repo --invert-paths --path wafr-app/app/signing/wafr-release.p12
```

```bash
git push --force --mirror
```

- هذا يغيّر معرّفات كل الـ commits في كل الفروع، فنفّذه بعد دمج كل طلبات الدمج المفتوحة.
- أعد استنساخ المستودع بعده.
- النسخ التي أخذها الآخرون أو خزّنها GitHub مؤقتاً قد تبقى. لذلك لا يُستخدم المفتاح القديم أبداً.

## 3. استضافة سياسة الخصوصية (مرة واحدة)

1. GitHub ← المستودع ← **Settings** ← **Pages** ← **Source: GitHub Actions**.
2. Actions ← **«Wafr privacy policy (GitHub Pages)»** ← **Run workflow**.
3. الرابط: `https://ahmed197113.github.io/-/privacy/`، وهو الرابط نفسه في التطبيق. ضعه في Play Console ← محتوى التطبيق ← سياسة الخصوصية.
4. قبل ذلك، استبدل `SUPPORT_EMAIL` في `wafr-app/store/privacy-policy.html` ببريد الدعم.

## 4. Play App Signing وأرقام الإصدار

- عند إنشاء التطبيق ورفع أول AAB، اختر **«استخدام مفتاح توقيع تنشئه Google»** (Use Google-generated key). هذا هو Play App Signing، وهو الافتراضي.
- **معرّف الحزمة `com.wafr.budget` لا يتغيّر بعد أول رفع.**
- `versionName` = **1.0.0**، وتغيّره يدوياً في `app/build.gradle.kts` عند كل إصدار للمستخدمين.
- `versionCode` = رقم تشغيل GitHub Actions + 100. يزيد تلقائياً مع كل بناء، كما يشترط Play.
- ملف الرفع: من صفحة التشغيل في Actions ← Artifacts ← `Wafr-v1.0.0-buildN` ← `Wafr-v1.0.0.aab`.
  - إن انتهى اسم الـ Artifact بـ `-UNSIGNED-debugkey` فالأسرار غير مضبوطة، ولا ترفع هذا الملف.

## 5. ملاحظة عن التحقق من هوية المطوّرين

بدأت Google في 30 سبتمبر 2026 فرض [تحقق هوية المطوّر](https://developer.android.com/developer-verification) على تثبيت التطبيقات من خارج المتاجر في البرازيل وإندونيسيا وسنغافورة وتايلاند، ويتوسع عالمياً في 2027. النشر عبر Google Play يشمل التحقق من هويتك عند فتح الحساب. أما ملف APK الموزّع خارج Play، فقد يحتاج لاحقاً إلى تسجيل التطبيق في برنامج التحقق.
