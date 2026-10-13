# برومت Cowork — رفع تحديث «نبضٌ صغير» 1.2

انسخ النص اللي تحت وابعته لـ Cowork:

---

أنتِ هتساعديني أرفع تحديث تطبيق «نبضٌ صغير» نسخة 1.2 على السيرفر وعلى Google Play. اشتغلي خطوة خطوة، وقبل أي ضغطة على «نشر» أو «حفظ» نهائي في Play Console وريني الشاشة واستني موافقتي.

**أ) السيرفر (SiteGround ← Site Tools):**
1. نزّلي `nabd-server.zip` من مستودع GitHub `ahmed197113/-` (الفرع `ccr-60c8a452-4z6177`، المجلد `pregnancy-app/server`) أو استخدمي الملف اللي هبعتهولك.
2. File Manager ← `public_html/nabd-api`: ارفعي `auth.php`, `backup.php`, `account.php`، واستبدلي `lib.php`, `community.php`, `admin.php`, `.htaccess`, `schema.sql`. **ما تلمسيش `config.php`.**
3. ارفعي `privacy.html` و`delete-account.html` في `public_html`.
4. MySQL ← phpMyAdmin ← القاعدة ← Import ← `schema.sql`.
5. عدّلي `nabd-api/config.php` وضيفي قبل `admin_token` (القيمة أبعتهالك):
   `'google_client_ids' => ['WEB_CLIENT_ID'], 'auth_daily_ip' => 40, 'backup_daily' => 400,`
6. افتحي `https://nabd.khatta.net/delete-account.html` و`https://nabd.khatta.net/privacy.html` واتأكدي إنهم بيفتحوا.

**ب) Google Cloud:** نفّذي الخطوات في `pregnancy-app/server/GOOGLE_SETUP.md` (شاشة الموافقة، Web client، و3 Android clients بالـ SHA-1). خدي SHA-1 بتاع App signing key من Play Console ← App integrity.

**ج) Google Play Console ← نبضٌ صغير:**
1. نزّلي أحدث `nabd.aab` من: https://github.com/ahmed197113/-/releases/download/nabd-latest/nabd.aab واتأكدي إن رقم الإصدار 1.2.x.
2. Test and release ← Closed testing ← Create new release ← ارفعي الملف.
3. Release notes (ar):
   ```
   <ar>
   • التقويم الهجري (أم القرى) مع الميلادي
   • إعداد جديد أسهل خطوة بخطوة
   • أرقام أوضح: الشهر، وما مضى، وما تبقّى، وعدّ تنازلي في آخر 4 أسابيع
   • المفضلة 💗 ومشاركة صورة أسبوعك
   • نسخ احتياطي اختياري على السحابة بحساب Google
   • ويدجت للشاشة الرئيسية
   </ar>
   ```
4. App content ← Data safety: حدّثيها من جدول «إجابات Data safety» في `GOOGLE_SETUP.md`.
5. App content ← Data deletion: `https://nabd.khatta.net/delete-account.html`.
6. وريني ملخص الإصدار قبل «Start rollout».
