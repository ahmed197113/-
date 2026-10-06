عايزك تركّب إضافة WordPress للمحاسبة (erp-metal-lines) على WordPress جديد ومنفصل على الدومين الفرعي https://erp.metal-lines.com على SiteGround. اشتغل من كروم، أنا مسجل دخول على SiteGround.

ممنوع منعاً باتاً تلمس موقع https://metal-lines.com الحالي: ملفاته، وقاعدة بياناته، وإيميلاته، وسجلات الـ DNS بتاعته. استثناء واحد بس: اللي محتاجه الدومين الفرعي erp.

== ملف الإضافة ==
- مرفق مع الرسالة: erp-metal-lines-0.1.0.zip
- أو نزّله من GitHub (لازم تكون مسجل دخول على GitHub في كروم لو المستودع خاص):
  https://github.com/ahmed197113/-/raw/claude/laughing-archimedes-eydoje/wp-plugin/dist/erp-metal-lines-0.1.0.zip
  ده نفس الملف الموجود في المستودع ahmed197113/- ، فرع claude/laughing-archimedes-eydoje ، مسار wp-plugin/dist/
- ارفع الـ ZIP زي ما هو، متفكّوش.

== 1) افحص قبل أي تغيير ==
- في SiteGround Site Tools بتاع metal-lines.com، افتح Domain ← DNS Zone Editor، وشوف هل فيه سجل اسمه erp (A أو CNAME).
  لو موجود ومشاور على مكان تاني (زي PythonAnywhere من محاولة قديمة): وقف واسألني قبل ما تعدّله أو تمسحه.
- افتح Domain ← Subdomains، وشوف هل erp.metal-lines.com متعمل قبل كده.

== 2) الدومين الفرعي وتركيب WordPress جديد ==
1. Domain ← Subdomains: اعمل subdomain اسمه erp لو مش موجود.
2. WordPress ← Install & Manage: ركّب WordPress جديد على erp.metal-lines.com:
   - اختار المسار الرئيسي للدومين الفرعي (مش مجلد فرعي).
   - لغة الموقع: العربية.
   - Admin username: اسم مش "admin"، مثلاً ml-erp-admin.
   - Password: ولّد كلمة سر قوية (20 حرف أو أكتر)، ومتكتبهاش في الشات.
   - Email: ahmed197113@gmail.com
   - لو سألك عن WordPress Starter أو أي إضافات إضافية، ارفضها.
   SiteGround بيعمل قاعدة بيانات جديدة ومستقلة للتركيب ده، اتأكد إنها مش قاعدة بيانات metal-lines.com.
3. Security ← SSL Manager: فعّل Let's Encrypt لـ erp.metal-lines.com.
   ومن Security ← HTTPS Enforce: فعّل HTTPS Enforce للدومين الفرعي ده بس.
4. Devs ← PHP Manager: خلّي إصدار PHP للدومين الفرعي 8.1 أو أحدث (8.2 أو 8.3 أفضل).

== 3) إعدادات WordPress قبل الإضافة ==
افتح https://erp.metal-lines.com/wp-admin :
1. Settings ← General:
   - تأكد إن «Anyone can register / أي شخص يستطيع التسجيل» مش متعلّم عليه.
   - المنطقة الزمنية: القاهرة.
   - لغة الموقع: العربية.
2. Plugins: امسح أي إضافة اتركّبت تلقائياً ما عدا «SiteGround Security».
   - امسح «SiteGround Optimizer» وأي إضافة كاش، لأن الكاش ممكن يعرض بيانات مستخدم لمستخدم تاني.
   - امسح Akismet وHello Dolly.
3. في Site Tools ← Speed ← Caching ← Dynamic Cache: اقفل الكاش لـ erp.metal-lines.com بس.
   ونفس الكلام لـ Memcached لو مفعّل على الدومين ده.

== 4) تركيب الإضافة ==
1. Plugins ← Add New ← Upload Plugin: ارفع erp-metal-lines-0.1.0.zip، وبعدين Install، وبعدين Activate.
   - لو ظهرت رسالة «امتداد PHP bcmath غير مفعّل»: من Devs ← PHP Manager ← PHP Extensions فعّل bcmath، وجرّب تاني.
   - لو ظهرت رسالة إن إصدار PHP قديم: ارجع لخطوة PHP Manager وغيّر الإصدار.
2. افتح https://erp.metal-lines.com/ . لازم تظهر «لوحة التحكم» بالعربي وبتصميم كامل، وفي أولها قائمة «ابدأ من هنا».
3. من القائمة الجانبية: «إدارة النظام وسجل التدقيق» ← «تشغيل التهيئة».
   لازم تظهر رسالة «تمت تهيئة النظام بنجاح»، وتكون شجرة الحسابات 113 حساب.
4. ممنوع تدخل أي بيانات حقيقية أو تجريبية. لو جرّبت أي حاجة أثناء الاختبار، امسحها في الآخر من «إدارة النظام» ← «مسح البيانات» (بتكتب «نعم» للتأكيد).

== 5) الأمان ==
1. SiteGround Security (من داخل WordPress):
   - فعّل Two-Factor Authentication لحساب المدير، واعمل الإعداد بالخطوات اللي بتطلع.
   - فعّل Limit Login Attempts.
   - فعّل Disable XML-RPC.
   هتحتاجني أصوّر QR code بموبايلي: وقف وقولّي لما توصل للخطوة دي.
2. اتأكد إن مفيش إضافات غير «نظام المحاسبة والمقاولات — الخطوط المعدنية» و«SiteGround Security».

== 6) التأكد (اعمله كله وبلّغني بالنتيجة) ==
- افتح https://erp.metal-lines.com/ في نافذة Incognito (من غير تسجيل دخول): لازم تتحول لصفحة تسجيل الدخول، ومتظهرش أي صفحة أو بيانات.
- افتح https://erp.metal-lines.com/wp-json/wp/v2/users من غير تسجيل دخول: لازم يرجع خطأ (401)، ومتظهرش قائمة مستخدمين.
- بعد تسجيل الدخول افتح الصفحات دي واتأكد إنها بتفتح من غير أخطاء:
  /accounts/   /journal/   /journal/new/   /journal/templates/   /reports/trial-balance/   /reports/ledger/   /settings/   /settings/system/   /settings/audit/
- اعمل قيد تجربة واحد من /journal/new/ بسطرين متساويين (مثلاً 100 مدين على 1211 الخزينة، و100 دائن على 3101 رأس المال):
  - احفظه كمسودة، وبعدين رحّله.
  - اتأكد إنه ظاهر في ميزان المراجعة.
  - امسحه: «إلغاء الترحيل»، وبعدين «حذف».
  - اتأكد إنه ظاهر في /settings/audit/.
- اتأكد إن https://metal-lines.com لسه شغال زي ما هو بالظبط.
- لو ظهرت صفحة «حدث خطأ غير متوقع»: افتح /settings/system/ وشوف رقم «أخطاء مسجلة داخلياً»، وبلّغني بالصفحة اللي حصل فيها الخطأ.

== 7) بلّغني في الآخر بـ ==
- الرابط، واسم مستخدم المدير، وكلمة السر في رسالة لوحدها.
- إصدار PHP اللي اتستخدم، وهل bcmath كان مفعّل ولا اتفعّل.
- نتيجة كل بند في خطوة 6.
- اتأكد إن Daily Backup بتاع SiteGround شغال على الدومين الفرعي ده (Security ← Backups).
- أي خطوة معرفتش تعملها وسببها.

ملاحظة: النسخة دي هي المرحلة الأولى بس (المحاسبة العامة: شجرة الحسابات، والقيود، وميزان المراجعة، والأستاذ، والنسخ الاحتياطي). المبيعات والمشتريات والمقاولات هتتضاف في المراحل الجاية بتحديث للإضافة نفسها، من غير ما البيانات تضيع.
