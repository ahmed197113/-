/* إعدادات النسخة المستقلة
   apiBase: رابط مجلد السيرفر على استضافتك (راجعي server/README.md) — يشغّل المساعد الذكي وقراءة التحاليل ومجتمع الأمهات.
   supabaseUrl/supabaseKey: بديل للمجتمع فقط عبر Supabase (راجعي COMMUNITY.md).
   googleWebClientId: معرّف عميل الويب (ليس سراً) — لزر Google في نسخة المتصفح. في تطبيق أندرويد يتم الدخول عبر Firebase (Google وFacebook).
   تسجيل الدخول يظهر فقط بعد ضبط apiBase (راجعي server/GOOGLE_SETUP.md). */
window.NABD_CONFIG = {
  apiBase: 'https://nabd.khatta.net/nabd-api',
  supabaseUrl: '',
  supabaseKey: '',
  googleWebClientId: '987831438755-a2c3ljr526b3hplfhr27mc3shnvlo22k.apps.googleusercontent.com',
  facebook: true // زر Facebook في تطبيق أندرويد
};
