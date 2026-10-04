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

  // الإيميل الذي تُرسل منه رموز الدخول (أنشئيه من Site Tools ← Email ← Accounts، مثل no-reply@دومينك)
  'mail_from' => 'no-reply@example.com',

  // كلمة سر صفحة الإشراف admin.php (اختاري كلمة طويلة)
  'admin_token' => 'CHANGE-ME-LONG-RANDOM',
];
