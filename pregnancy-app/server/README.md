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
7. أرسلي رابط `https://دومينك/nabd-api` ليوضع في `config.js` داخل التطبيق.

## الحماية المضمّنة
- مفتاح Gemini على السيرفر فقط، وتعليمات المساعد ثابتة ولا تُغيَّر من التطبيق.
- حد يومي لكل جهاز ولكل IP (قابل للتعديل في `config.php`).
- منع الروابط وأرقام الهواتف في المجتمع، وإخفاء تلقائي بعد 3 بلاغات، وحظر من صفحة الإشراف.
- `.htaccess` يمنع فتح `config.php` و`lib.php` و`schema.sql` من المتصفح.
