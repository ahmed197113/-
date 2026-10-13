/* إعدادات النسخة المستقلة
   apiBase: رابط مجلد السيرفر على استضافتك (راجعي server/README.md) — يشغّل المساعد الذكي وقراءة التحاليل ومجتمع الأمهات.
   supabaseUrl/supabaseKey: بديل للمجتمع فقط عبر Supabase (راجعي COMMUNITY.md).
   googleWebClientId: معرّف عميل الويب من Google Cloud (ليس سراً) — يفعّل تسجيل الدخول الاختياري والنسخ على السحابة (راجعي server/GOOGLE_SETUP.md). */
window.NABD_CONFIG = {
  apiBase: '', // مثال: https://example.com/nabd-api
  supabaseUrl: '',
  supabaseKey: '',
  googleWebClientId: '' // مثال: 1234567890-abc.apps.googleusercontent.com
};
