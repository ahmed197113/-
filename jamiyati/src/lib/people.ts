// إدخال الأعضاء بسرعة: تطبيع أرقام الجوال، وتحليل قائمة ملصوقة (من واتساب أو ملاحظات)
import { COUNTRIES } from './auth';

/** رمز الدولة الافتراضي من رقم المستخدم نفسه */
export function countryOf(phone: string): string {
  return COUNTRIES.map((c) => c.code).sort((a, b) => b.length - a.length).find((c) => phone.startsWith(c)) ?? '966';
}

/** يحوّل أي صيغة (+966 50 123 4567، 0501234567، ٠٥٠١٢٣٤٥٦٧، 00966…) إلى صيغة دولية بلا + */
export function toIntl(raw: string, country: string): string {
  let p = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const plus = p.trim().startsWith('+');
  p = p.replace(/\D/g, '');
  if (!p) return '';
  if (plus) return p;
  if (p.startsWith('00')) return p.slice(2);
  if (p.startsWith(country) && p.length > 9) return p;
  return country + p.replace(/^0+/, '');
}

export interface PersonEntry {
  name: string;
  phone: string;
  units: number;
}

/**
 * سطر لكل عضو: "محمد 0501234567" أو "0501234567 محمد" أو "محمد" فقط.
 * "نصف" أو "½" في السطر = نصف سهم، و"سهمين"/"2 سهم" = سهمان. الترقيم والرموز في البداية تُحذف.
 */
export function parsePeopleList(text: string, country: string): PersonEntry[] {
  return text
    .split(/\r?\n|،|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      const m = normalized.match(/\+?[\d][\d\s-]{7,}\d/);
      const phone = m ? toIntl(m[0], country) : '';
      let name = (m ? normalized.replace(m[0], ' ') : normalized)
        .replace(/^[\s\d.)\-–•*]+/, '')
        .replace(/(نصف سهم|نص سهم|نصف|½|سهمين|سهمان|2 سهم)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const units = /نصف|نص سهم|½/.test(line) ? 0.5 : /سهمين|سهمان|2 سهم/.test(line) ? 2 : 1;
      if (!name && phone) name = phone;
      return { name, phone, units };
    })
    .filter((p) => p.name);
}
