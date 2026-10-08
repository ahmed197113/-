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
  // نماذج بديلة تُجرب تلقائياً إذا كان الأساسي مشغولاً (429/503)
  'fallback_models' => ['gemini-flash-lite-latest'],

  // حدود الاستخدام اليومية لكل جهاز (لحماية الرصيد)
  'ai_daily_chat' => 30,
  'ai_daily_labs' => 5,
  'ai_daily_ip'   => 200,

  // الإيميل الذي تُرسل منه رموز الدخول — على نفس دومين الموقع في SiteGround
  // (أنشئيه من Site Tools ← Email ← Accounts، مثل no-reply@nabd.khatta.net)
  'mail_from' => 'no-reply@nabd.khatta.net',

  // الأفضل: الإرسال من حساب Gmail بكلمة مرور التطبيقات (myaccount.google.com/apppasswords)
  // تصل الرموز للبريد الوارد بدون إعداد DNS. عند وجوده يُتجاهل mail_from ويكون المرسل هو حساب Gmail.
  // 'smtp' => ['host' => 'smtp.gmail.com', 'port' => 465, 'secure' => 'ssl', 'user' => 'xxx@gmail.com', 'pass' => 'abcdefghijklmnop'],

  // كلمة سر صفحة الإشراف admin.php (اختاري كلمة طويلة)
  'admin_token' => 'CHANGE-ME-LONG-RANDOM',
];
