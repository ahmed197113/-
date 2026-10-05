import { describe, expect, it } from 'vitest';
import { countryOf, parsePeopleList, toIntl } from './people';

describe('إدخال الأعضاء', () => {
  it('تطبيع الأرقام بكل الصيغ', () => {
    expect(toIntl('0501234567', '966')).toBe('966501234567');
    expect(toIntl('+966 50 123 4567', '20')).toBe('966501234567');
    expect(toIntl('00201001234567', '966')).toBe('201001234567');
    expect(toIntl('٠١٠٠١٢٣٤٥٦٧', '20')).toBe('201001234567');
    expect(toIntl('966501234567', '966')).toBe('966501234567');
    expect(countryOf('201001234567')).toBe('20');
    expect(countryOf('966500000001')).toBe('966');
  });

  it('تحليل قائمة ملصوقة', () => {
    const list = parsePeopleList('1. محمد 0501234567\n0552223333 سارة\nخالد نصف سهم\n- ريم ٠٥٤١١١٢٢٢٢ سهمين\n\n', '966');
    expect(list).toEqual([
      { name: 'محمد', phone: '966501234567', units: 1 },
      { name: 'سارة', phone: '966552223333', units: 1 },
      { name: 'خالد', phone: '', units: 0.5 },
      { name: 'ريم', phone: '966541112222', units: 2 },
    ]);
  });
});
