# نظام إدارة العهد — نسخة PHP لاستضافة SiteGround

نسخة من الخادم بلغة PHP 8 تعمل على الاستضافة المشتركة بدون Node.js، بنفس واجهة `/api/*` تماماً، فيعمل تطبيق الويب وتطبيق أندرويد بدون أي تعديل.

## المحتويات
| الملف | الوظيفة |
|---|---|
| `core.php` | منطق النظام (نقل حرفي لـ `public/core.js`) |
| `api.php` | نقطة الدخول لكل مسارات `/api/*` (مكافئ `server.js`) |
| `.htaccess` | توجيه `/api/*` إلى `api.php`، وباقي المسارات للواجهة، وتمرير ترويسة `Authorization` |
| `data/` | احتياطي فقط: البيانات تُحفظ تلقائياً في مجلد `custody-data` المجاور لجذر الموقع (خارج `public_html`)، ولا يُستخدم `data/` إلا إن تعذّر ذلك |
| `.user.ini` | حدود PHP لرفع المرفقات حتى 25MB واستعادة النسخ الاحتياطية |
| `router.php` | للتجربة المحلية فقط (`php -S`) ولا يُرفع للاستضافة |

## الرفع على SiteGround
1. حمّل الملف `custody-siteground.zip` من صفحة Releases في GitHub (آخر إصدار باسم `custody-php-v…`).
2. من **Site Tools ← Domain ← Subdomains** أنشئ النطاق الفرعي `custody.metal-lines.com`.
3. من **Site Tools ← Site ← File Manager** افتح المجلد الخاص بالنطاق الفرعي، ثم ارفع الملف المضغوط واختر **Extract** لفكه داخله مباشرة (يجب أن يكون `index.html` و `api.php` في جذر المجلد).
4. من **Site Tools ← Security ← SSL Manager** فعّل شهادة Let's Encrypt للنطاق الفرعي، ثم من **HTTPS Enforce** فعّل التحويل الإجباري إلى HTTPS.
5. من **Site Tools ← Devs ← PHP Manager** تأكد أن الإصدار PHP 8.0 أو أحدث.
6. افتح `https://custody.metal-lines.com` وأنشئ حساب مدير النظام، وفي تطبيق أندرويد اختر «الربط بخادم الشركة» وأدخل نفس الرابط.

> **مهم:** الواجهة تستخدم مسارات تبدأ من جذر النطاق (`/api/…` و `/app.js`)، لذلك يجب أن يعمل النظام على نطاق فرعي مستقل مثل `custody.metal-lines.com`. فكّ الملف في `public_html/custody` وفتحه كـ `metal-lines.com/custody` لن يعمل، إلا إذا كان النطاق الفرعي موجّهاً إلى هذا المجلد.

## التحقق بعد الرفع
- `https://custody.metal-lines.com/api/status` يجب أن يعرض `{"needsSetup":true,...}` قبل الإعداد.
- `https://custody.metal-lines.com/data/db.json` يجب ألا يعرض أي بيانات (403 أو 404).
- في File Manager يجب أن يظهر المجلد `custody-data` بجانب `public_html` (وليس داخله) بعد أول فتح للنظام.

> **لماذا خارج الجذر؟** SiteGround يقدّم الملفات الثابتة مثل `.json` والصور عبر NGINX مباشرة دون المرور على `.htaccess`، فلا تكفي حماية `data/.htaccess`. عند التحديث من نسخة قديمة تُنقل `data/db.json` و `data/files/` تلقائياً إلى `custody-data` مع أول طلب.
- إذا ظهرت رسالة «يجب تسجيل الدخول» بعد الدخول مباشرة فالاستضافة تحذف ترويسة `Authorization`؛ ملف `.htaccess` المرفق يعالج ذلك، فتأكد أنه رُفع (الملفات التي تبدأ بنقطة قد تكون مخفية في File Manager).
- إذا فشل رفع صور كبيرة فارفع الحدود من **PHP Manager ← PHP Variables**: `post_max_size` و `upload_max_filesize` إلى 110M، و `memory_limit` إلى 512M.

## النسخ الاحتياطي والنقل
- من الإعدادات داخل النظام: «تنزيل نسخة احتياطية» يحفظ البيانات (بدون المرفقات، مثل خادم Node.js). المرفقات في `custody-data/files/` وتشملها النسخ الاحتياطية اليومية لـ SiteGround، ويمكن تنزيلها من File Manager.
- «استعادة نسخة» تقبل:
  - نسخ هذا الخادم وخادم Node.js (تبقى كلمات المرور صالحة).
  - نسخ التشغيل على الجوال مع المرفقات التي بداخلها (حقل `__files`)، وتبقى كلمات المرور صالحة أيضاً.
- كلمات المرور الجديدة تُحفظ بـ `password_hash`.

## التحديث لاحقاً
ارفع الإصدار الجديد من الملف المضغوط وفكّه فوق القديم. مجلد `data/` في الملف المضغوط لا يحتوي إلا `.htaccess`، والبيانات في `custody-data` خارج الجذر، فلا تُمس.

## التجربة المحلية
```bash
mkdir -p /tmp/site && cp -r ../public/. /tmp/site/ && cp -r . /tmp/site/
cd /tmp/site && php -S localhost:8080 router.php
# DEMO=1 لتحميل البيانات التجريبية، DATA_DIR لتغيير مكان البيانات (الافتراضي /tmp/custody-data هنا)
```
