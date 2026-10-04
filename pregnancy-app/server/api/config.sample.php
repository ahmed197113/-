<?php
/* نبضٌ صغير — إعدادات السيرفر
   انسخي هذا الملف باسم config.php واكتبي بياناتك. لا ترسلي هذا الملف لأحد. */
return [
  // قاعدة البيانات (Site Tools ← Site ← MySQL)
  'db_dsn'  => 'mysql:host=localhost;dbname=DB_NAME;charset=utf8mb4',
  'db_user' => 'DB_USER',
  'db_pass' => 'DB_PASSWORD',

  // مفتاح Claude من console.anthropic.com ← API Keys
  'anthropic_key' => 'sk-ant-...',
  'model'         => 'claude-opus-5-5',

  // حدود الاستخدام اليومية لكل جهاز (لحماية الرصيد)
  'ai_daily_chat' => 30,
  'ai_daily_labs' => 5,
  'ai_daily_ip'   => 200,

  // كلمة سر صفحة الإشراف admin.php (اختاري كلمة طويلة)
  'admin_token' => 'CHANGE-ME-LONG-RANDOM',
];
