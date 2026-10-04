// ترجمة خفيفة: كل نص يُكتب بالعربية والإنجليزية في مكانه — يضمن تغطية كاملة دون ملفات مفاتيح طويلة.
let lang: 'ar' | 'en' = 'ar';

export function setLang(l: 'ar' | 'en') {
  lang = l;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }
}

export const getLang = () => lang;

/** L('نص عربي', 'English text') */
export function L(ar: string, en: string): string {
  return lang === 'ar' ? ar : en;
}
