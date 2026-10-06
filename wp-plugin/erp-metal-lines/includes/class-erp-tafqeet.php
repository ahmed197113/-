<?php
/** تفقيط المبالغ بالعربية — نقل حرفي لـ accounting/tafqeet.py (التقريب هنا ROUND_HALF_UP كما في الأصل). */
defined('ABSPATH') || exit;

final class ERP_Tafqeet
{
    const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر',
        'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const SCALES = [null, ['ألف', 'ألفان', 'آلاف'], ['مليون', 'مليونان', 'ملايين'], ['مليار', 'ملياران', 'مليارات']];

    private static function below_thousand(int $n): string
    {
        $parts = [];
        $h = intdiv($n, 100);
        $rest = $n % 100;
        if ($h) {
            $parts[] = self::HUNDREDS[$h];
        }
        if ($rest) {
            if ($rest < 20) {
                $parts[] = self::ONES[$rest];
            } else {
                $t = intdiv($rest, 10);
                $o = $rest % 10;
                $parts[] = $o ? self::ONES[$o] . ' و' . self::TENS[$t] : self::TENS[$t];
            }
        }
        return implode(' و', $parts);
    }

    public static function number_to_words(string $n): string
    {
        if (bccomp($n, '0', 0) === 0) {
            return 'صفر';
        }
        $groups = [];
        $i = 0;
        while (bccomp($n, '0', 0) > 0) {
            $g = (int) bcmod($n, '1000');
            $n = bcdiv($n, '1000', 0);
            if ($g) {
                if ($i === 0) {
                    $groups[] = self::below_thousand($g);
                } else {
                    [$one, $two, $many] = self::SCALES[$i];
                    if ($g === 1) {
                        $groups[] = $one;
                    } elseif ($g === 2) {
                        $groups[] = $two;
                    } elseif ($g >= 3 && $g <= 10) {
                        $groups[] = self::below_thousand($g) . ' ' . $many;
                    } elseif ($g % 100 >= 11 && $g % 100 <= 99) {
                        $groups[] = self::below_thousand($g) . ' ' . $one . 'ًا';
                    } elseif ($g % 100 >= 3 && $g % 100 <= 10) {
                        $groups[] = self::below_thousand($g) . ' ' . $many;
                    } else {
                        $groups[] = self::below_thousand($g) . ' ' . $one;
                    }
                }
            }
            $i++;
        }
        return implode(' و', array_reverse($groups));
    }

    public static function amount_to_words($amount, string $currency = 'جنيه', string $sub = 'قرش'): string
    {
        $amount = ERP_Money::round(ERP_Money::norm($amount ?? '0'), 2, 'half_up');
        $neg = ERP_Money::cmp($amount, '0') < 0;
        $amount = ERP_Money::abs($amount);
        [$whole, $frac] = array_pad(explode('.', $amount), 2, '0');
        $frac = (int) str_pad(substr($frac, 0, 2), 2, '0');
        $text = self::number_to_words($whole) . ' ' . $currency;
        if ($frac) {
            $text .= ' و' . self::number_to_words((string) $frac) . ' ' . $sub;
        }
        $text = 'فقط ' . $text . ' لا غير';
        return $neg ? 'سالب ' . $text : $text;
    }
}
