<?php
/* نبضٌ صغير — إعدادات السيرفر
   انسخي هذا الملف باسم config.php واكتبي بياناتك. لا ترسلي هذا الملف لأحد. */
return [
  // قاعدة البيانات (Site Tools ← Site ← MySQL)
  'db_dsn'  => 'mysql:host=localhost;dbname=DB_NAME;charset=utf8mb4',
  'db_user' => 'DB_USER',
  'db_pass' => 'DB_PASSWORD',

  // مفتاح Gemini المجاني من aistudio.google.com ← Get API key
  'gemini_key' => 'AIza...',
  'model'      => 'gemini-flash-latest',

  // حدود الاستخدام اليومية لكل جهاز (لحماية الرصيد)
  'ai_daily_chat' => 30,
  'ai_daily_labs' => 5,
  'ai_daily_ip'   => 200,

  // تسجيل الدخول الاختياري: معرّف عميل الويب (Web client ID) لزر Google في نسخة المتصفح
  'google_client_ids' => ['987831438755-a2c3ljr526b3hplfhr27mc3shnvlo22k.apps.googleusercontent.com'],
  // تطبيق أندرويد يسجّل الدخول عبر Firebase (Google وFacebook): معرّف مشروع Firebase
  'firebase_project_id' => 'nabd-saghir',
  'auth_daily_ip' => 40,   // محاولات تسجيل الدخول لكل IP يومياً
  'backup_daily'  => 400,  // مرات حفظ النسخة لكل حساب يومياً

  // كلمة سر صفحة الإشراف admin.php (اختاري كلمة طويلة)
  'admin_token' => 'CHANGE-ME-LONG-RANDOM',
];
