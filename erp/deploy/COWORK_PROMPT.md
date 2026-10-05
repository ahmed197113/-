عايزك تركّب برنامج المحاسبة والمقاولات (Django) على الدومين الفرعي https://erp.metal-lines.com، من غير أي تغيير في موقع WordPress الحالي على metal-lines.com. اشتغل من كروم، أنا مسجل دخول على PythonAnywhere وSiteGround.

== الملفات المرفقة مع الرسالة دي ==
- metal-lines-erp.zip: البرنامج كامل. لما تفكه هيطلع مجلد اسمه erp_app.
- جوه erp_app/deploy هتلاقي:
  - pythonanywhere_wsgi.py: محتوى ملف WSGI الجاهز.
  - backup_db.py: سكربت النسخة الاحتياطية اليومية.
(لو الـ ZIP مش متاح، نفس الملفات موجودة على GitHub: https://github.com/ahmed197113/- فرع claude/laughing-archimedes-eydoje جوه مجلد erp)

== قبل ما تبدأ ==
- ادخل PythonAnywhere واتأكد إن الحساب خطة مدفوعة (Hacker أو أعلى)، لأن الحساب المجاني مش بيسمح بدومين خاص.
  لو مجاني: وقف وبلّغني، ومتدفعش أو تشترك في أي حاجة من غير موافقتي.
- اعرف اسم المستخدم بتاعك على PythonAnywhere، هنسميه USERNAME في الخطوات اللي جاية.

== على PythonAnywhere ==
1. من تبويب Files ارفع metal-lines-erp.zip للمجلد /home/USERNAME/، وبعدين من Bash console:
   cd ~ && unzip metal-lines-erp.zip
   المفروض يطلع مجلد ~/erp_app وجواه manage.py.
2. اعمل الـ virtualenv وثبّت المكتبات:
   mkvirtualenv erp-venv --python=python3.11
   (لو 3.11 مش موجود استخدم أحدث إصدار 3.x متاح، بشرط يكون 3.10 أو أحدث)
   cd ~/erp_app && pip install -r requirements.txt
3. ولّد مفتاح سري ومتكتبهوش في الشات:
   python -c "import secrets; print(secrets.token_urlsafe(50))"
4. من تبويب Web: Add a new web app ← اكتب الدومين erp.metal-lines.com ← Manual configuration ← نفس إصدار Python.
   - Source code: /home/USERNAME/erp_app
   - Working directory: /home/USERNAME/erp_app
   - Virtualenv: /home/USERNAME/.virtualenvs/erp-venv
5. افتح ملف الـ WSGI من نفس الصفحة (الرابط اللي تحت "WSGI configuration file")، امسح كل اللي فيه، وحط مكانه محتوى ملف ~/erp_app/deploy/pythonanywhere_wsgi.py.
   بعدين بدّل YOUR_USERNAME باسم المستخدم (في كل الأماكن)، وPUT_SECRET_KEY_HERE بالمفتاح اللي ولّدته في خطوة 3. واحفظ.
6. في الـ Bash console، والـ virtualenv شغال (workon erp-venv):
   cd ~/erp_app
   python manage.py migrate
   python manage.py collectstatic --noinput
   python manage.py setup_company --admin-user admin --admin-password "<ولّد كلمة سر قوية 16 حرف أو أكتر>"
   ممنوع تشغّل load_demo (دي بيانات تجريبية).
   لو جرّبت تدخل أي بيانات أثناء الاختبار، شغّل في الآخر: python manage.py reset_data --yes
7. في تبويب Web، قسم Static files، ضيف السطر ده:
   URL: /static/    Directory: /home/USERNAME/erp_app/staticfiles
8. اضغط Reload وافتح https://USERNAME.pythonanywhere.com، لازم تظهر صفحة تسجيل الدخول بالعربي.
   (لو الدومين ده مش متاح في خطتك، كمّل للخطوة 9 وجرّب على erp.metal-lines.com بعد ما الـ DNS ينتشر.)
9. من تبويب Web انسخ قيمة الـ CNAME اللي PythonAnywhere بيديها للدومين (شكلها webapp-XXXXXX.pythonanywhere.com).

== على SiteGround (Site Tools ← Domain ← DNS Zone Editor) ==
10. ضيف سجل CNAME واحد بس:
    Name: erp    ←    Resolves to: القيمة اللي في خطوة 9
    ممنوع تعدّل أو تمسح أي سجل تاني. ومتلمسش ملفات WordPress أو الإيميلات أو إعدادات metal-lines.com.
    لو لقيت سجل اسمه erp موجود قبل كده، وقف واسألني.

== SSL والتشغيل ==
11. استنى لحد ما erp.metal-lines.com يوصل لـ PythonAnywhere (ممكن ياخد من دقائق لساعات، وتقدر تتأكد من https://dnschecker.org).
    بعدين من تبويب Web: قسم HTTPS certificate ← فعّل Let's Encrypt، وفعّل Force HTTPS، واضغط Reload.
12. من تبويب Tasks اعمل Scheduled task يومي الساعة 02:00 بالأمر ده:
    /home/USERNAME/.virtualenvs/erp-venv/bin/python /home/USERNAME/erp_app/deploy/backup_db.py
    (بيحفظ نسخة في ~/backups كل يوم، وبيحتفظ بآخر 30 نسخة)

== التأكد ==
- https://erp.metal-lines.com: لازم تظهر صفحة "تسجيل الدخول" بالعربي وبتنسيق كامل، مش صفحة HTML من غير تصميم.
- سجل دخول، واتأكد إن لوحة التحكم ظاهرة وفيها قائمة "ابدأ من هنا"، وإن مفيش أي بيانات تجريبية.
- افتح الصفحات دي واتأكد إن كلها شغالة من غير أخطاء: /accounts/ و /certificates/new/?kind=client و /reports/trial-balance/ و /settings/
- جرّب تحفظ حاجة بسيطة، مثلاً عدّل رقم تليفون الشركة من /settings/، عشان تتأكد إن الحفظ مش بيطلع خطأ 403 CSRF. وبعدين رجّعه زي ما كان.
- لو ظهر خطأ 500 أو 403 اقرا الـ error log من تبويب Web وصلّحه.
- اتأكد إن https://metal-lines.com (موقع WordPress) لسه شغال زي ما هو.

== بلّغني في الآخر بـ ==
- الرابط واسم المستخدم admin، وكلمة السر في رسالة لوحدها.
- إصدار Python اللي استخدمته، واسم المستخدم على PythonAnywhere.
- أي خطوة معرفتش تعملها وسببها.
- خطوات تحديث البرنامج بعدين: ارفع النسخة الجديدة وفكها فوق ~/erp_app (من غير ما تمسح db.sqlite3) ← workon erp-venv ← pip install -r requirements.txt ← python manage.py migrate ← python manage.py collectstatic --noinput ← Reload من تبويب Web.
