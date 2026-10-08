# سيرفر «نبضٌ صغير» على SiteGround

يشغّل: المساعد الذكي · قراءة صور التحاليل · مجتمع الأمهات · صفحة الإشراف · سياسة الخصوصية.

## الخطوات (مرة واحدة)
1. **SSL:** Site Tools ← Security ← SSL Manager ← فعّلي Let's Encrypt للدومين.
2. **قاعدة البيانات:** Site Tools ← Site ← MySQL ← Databases: أنشئي قاعدة، ثم Users: مستخدم وكلمة سر، واربطيه بالقاعدة (All Privileges).
3. **الجداول:** Site Tools ← Site ← MySQL ← phpMyAdmin ← اختاري القاعدة ← Import ← ارفعي `api/schema.sql`.
4. **الملفات:** Site Tools ← Site ← File Manager ← `public_html` ← أنشئي مجلد `nabd-api` وارفعي فيه محتويات مجلد `api` كلها، وارفعي `privacy.html` في `public_html`.
5. **الإعدادات:** داخل `nabd-api` انسخي `config.sample.php` باسم `config.php` وعدّليه:
   - بيانات القاعدة (`DB_NAME`, `DB_USER`, `DB_PASSWORD`).
   - مفتاح Gemini المجاني من aistudio.google.com ← Get API key (بحساب Google، بدون بطاقة).
   - `admin_token`: كلمة سر طويلة لصفحة الإشراف.
6. **اختبار:** افتحي `https://دومينك/nabd-api/admin.php` وادخلي بكلمة الإشراف.
7. **إيميل رموز الدخول (للحساب) — الطريقة الأضمن:** أنشئي حساب Gmail خاصاً بالتطبيق، وفعّلي فيه التحقق بخطوتين، ثم من myaccount.google.com/apppasswords أنشئي «كلمة مرور تطبيق» (16 حرفاً). أضيفي في `config.php`:
   `'smtp' => ['host' => 'smtp.gmail.com', 'port' => 465, 'secure' => 'ssl', 'user' => 'الحساب@gmail.com', 'pass' => 'كلمة المرور بدون مسافات'],`
   للفحص: أرسلي POST إلى `account.php` بالمحتوى `{"action":"mail_test","admin":"<admin_token>","email":"<إيميلك>"}` ويرجع سبب الفشل إن وُجد.
   **أو بدون Gmail:** Site Tools ← Email ← Accounts: أنشئي إيميلاً على دومين الموقع نفسه (مثل `no-reply@nabd.khatta.net`)، واكتبيه في `mail_from` داخل `config.php`.
   حتى لا تذهب الرموز إلى Spam أضيفي سجلّي SPF وDKIM. إن كان DNS الدومين خارج SiteGround فأضيفيهما عند الجهة التي تدير DNS:
   - SPF: سجل TXT على اسم الدومين، وقيمته من Site Tools ← Email ← Authentication ← SPF.
   - DKIM: سجل TXT باسم `default._domainkey.<الدومين>`، وقيمته من Site Tools ← Email ← Authentication ← DKIM.
8. أرسلي رابط `https://دومينك/nabd-api` ليوضع في `config.js` داخل التطبيق.
9. **إذا قال المساعد «مشغول الآن»:** معناها أن Gemini رد بـ 429 (تجاوز حد الخطة المجانية) أو 503 (النموذج مزدحم). السيرفر يجرّب تلقائياً النماذج البديلة في `fallback_models` داخل `config.php` (الافتراضي `gemini-flash-lite-latest`).
   لمعرفة السبب بالضبط أرسلي POST إلى `ai.php` بالمحتوى `{"mode":"test","admin":"<admin_token>"}`؛ يرجع لكل نموذج رمز HTTP ورسالة Google.
   - `429` مع `RESOURCE_EXHAUSTED`: انتهت حصة اليوم المجانية للمفتاح؛ انتظري للغد، أو فعّلي الفوترة في Google AI Studio، أو غيّري `model` لنموذج حصته أكبر.
   - `400`/`403`: المفتاح خطأ أو غير مفعّل؛ أنشئي مفتاحاً جديداً من aistudio.google.com.
   - `404`: اسم النموذج غير موجود؛ غيّري `model`.

## تحديث سيرفر قائم (إضافة الحساب)
إن كان السيرفر يعمل من قبل: ارفعي `account.php` الجديد إلى `nabd-api`، وأعيدي Import لملف `schema.sql` (آمن، ينشئ الجداول الجديدة فقط)، وأضيفي `mail_from` إلى `config.php` كما في الخطوة 7.

## الحماية المضمّنة
- مفتاح Gemini على السيرفر فقط، وتعليمات المساعد ثابتة ولا تُغيَّر من التطبيق.
- حد يومي لكل جهاز ولكل IP (قابل للتعديل في `config.php`).
- منع الروابط وأرقام الهواتف في المجتمع، وإخفاء تلقائي بعد 3 بلاغات، وحظر من صفحة الإشراف.
- Gmail المجاني يرسل حتى 500 رسالة يومياً تقريباً، وهذا يكفي في البداية.
- الحساب بلا كلمة سر: رمز من 6 أرقام على الإيميل صالح 15 دقيقة و5 محاولات، و6 رموز يومياً لكل إيميل.
- `.htaccess` يمنع فتح `config.php` و`lib.php` و`schema.sql` من المتصفح.
