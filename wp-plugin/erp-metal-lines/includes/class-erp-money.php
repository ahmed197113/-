<?php
/**
 * حسابات الفلوس والكميات بـ bcmath فقط (ممنوع float).
 *
 * يطابق سلوك Python Decimal في البرنامج الأصلي:
 * - السياق الافتراضي: دقة 28 رقماً معنوياً، والتقريب ROUND_HALF_EVEN (تقريب البنوك).
 * - r2() في الأصل = quantize(0.01) بنفس السياق ⇒ HALF_EVEN.
 * - Django يقرّب أي Decimal لعدد خانات العمود قبل الحفظ بـ HALF_EVEN أيضاً (format_number).
 * - التفقيط وحده يستخدم ROUND_HALF_UP.
 *
 * كل القيم نصوص (strings) بالصيغة العشرية العادية بدون فواصل.
 */
defined('ABSPATH') || exit;

final class ERP_Money
{
    /** خانات عشرية داخلية للعمليات الوسيطة (أكبر بكثير من أي عمود). */
    const SCALE = 40;
    /** دقة سياق Python Decimal الافتراضي. */
    const PREC = 28;

    /** يحوّل أي قيمة رقمية مقبولة إلى نص عشري قياسي، ويرفض غير ذلك. */
    public static function norm($v): string
    {
        if ($v === null || $v === '') {
            return '0';
        }
        if (is_int($v)) {
            return (string) $v;
        }
        if (is_float($v)) {
            throw new InvalidArgumentException('ERP_Money: float غير مسموح به في الحسابات المالية');
        }
        $s = trim((string) $v);
        if (!preg_match('/^([+-])?(\d+)(?:\.(\d*))?$|^([+-])?\.(\d+)$/', $s, $m)) {
            throw new InvalidArgumentException('ERP_Money: قيمة رقمية غير صالحة: ' . $s);
        }
        if (isset($m[5]) && $m[5] !== '') {
            $sign = $m[4] ?? '';
            $int = '0';
            $frac = $m[5];
        } else {
            $sign = $m[1] ?? '';
            $int = ltrim($m[2], '0');
            $int = $int === '' ? '0' : $int;
            $frac = $m[3] ?? '';
        }
        $frac = rtrim($frac, '0');
        $out = $frac === '' ? $int : $int . '.' . $frac;
        if ($sign === '-' && $out !== '0') {
            $out = '-' . $out;
        }
        return $out;
    }

    private static function trim_zeros(string $s): string
    {
        if (strpos($s, '.') !== false) {
            $s = rtrim(rtrim($s, '0'), '.');
        }
        if ($s === '-0' || $s === '' || $s === '-') {
            return '0';
        }
        return $s;
    }

    public static function is_zero($a): bool
    {
        return bccomp(self::norm($a), '0', self::SCALE) === 0;
    }

    public static function cmp($a, $b): int
    {
        return bccomp(self::norm($a), self::norm($b), self::SCALE);
    }

    public static function neg($a): string
    {
        return self::trim_zeros(bcmul(self::norm($a), '-1', self::SCALE));
    }

    public static function abs($a): string
    {
        $a = self::norm($a);
        return $a[0] === '-' ? substr($a, 1) : $a;
    }

    public static function max($a, $b): string
    {
        return self::cmp($a, $b) >= 0 ? self::norm($a) : self::norm($b);
    }

    public static function min($a, $b): string
    {
        return self::cmp($a, $b) <= 0 ? self::norm($a) : self::norm($b);
    }

    // ------------------------------------------------------------------ العمليات (بسياق Python: 28 رقماً معنوياً)
    public static function add($a, $b): string
    {
        return self::ctx(bcadd(self::norm($a), self::norm($b), self::SCALE));
    }

    public static function sub($a, $b): string
    {
        return self::ctx(bcsub(self::norm($a), self::norm($b), self::SCALE));
    }

    public static function mul($a, $b): string
    {
        return self::ctx(bcmul(self::norm($a), self::norm($b), self::SCALE));
    }

    public static function div($a, $b): string
    {
        $b = self::norm($b);
        if (bccomp($b, '0', self::SCALE) === 0) {
            throw new DivisionByZeroError('ERP_Money: قسمة على صفر');
        }
        // نحسب بخانات كافية ثم نقرّب لـ 28 رقماً معنوياً كما يفعل Python
        return self::ctx(bcdiv(self::norm($a), $b, self::SCALE + 20));
    }

    /** مجموع قائمة قيم. */
    public static function sum(array $values): string
    {
        $t = '0';
        foreach ($values as $v) {
            $t = self::add($t, $v);
        }
        return $t;
    }

    /** تقريب لعدد أرقام معنوية (سياق Decimal) بـ HALF_EVEN. */
    public static function ctx(string $x): string
    {
        $x = self::trim_zeros($x);
        $neg = $x[0] === '-';
        $abs = $neg ? substr($x, 1) : $x;
        $parts = explode('.', $abs);
        $int = ltrim($parts[0], '0');
        $frac = $parts[1] ?? '';
        if ($int !== '') {
            $sig = strlen($int) + strlen($frac);
            if ($sig <= self::PREC) {
                return $x;
            }
            $places = self::PREC - strlen($int);
        } else {
            $lead = strlen($frac) - strlen(ltrim($frac, '0'));
            $sig = strlen($frac) - $lead;
            if ($sig <= self::PREC) {
                return $x;
            }
            $places = $lead + self::PREC;
        }
        if ($places < 0) {
            // أعداد أكبر من 28 رقماً صحيحاً — غير واردة في النظام
            throw new RangeException('ERP_Money: قيمة تتجاوز دقة النظام');
        }
        return self::round($x, $places);
    }

    // ------------------------------------------------------------------ التقريب
    /** تقريب لعدد خانات عشرية بطريقة HALF_EVEN (افتراضي Python/Django). */
    public static function round($x, int $places, string $mode = 'half_even'): string
    {
        $x = self::norm($x);
        $neg = $x[0] === '-';
        $abs = $neg ? substr($x, 1) : $x;
        $trunc = bcadd($abs, '0', $places);              // قطع نحو الصفر
        $rem = bcsub($abs, $trunc, self::SCALE + 20);     // الباقي (موجب)
        $half = bcdiv('5', bcpow('10', (string) ($places + 1), 0), $places + 2);
        $c = bccomp($rem, $half, self::SCALE + 20);
        $up = false;
        if ($c > 0) {
            $up = true;
        } elseif ($c === 0) {
            if ($mode === 'half_up') {
                $up = true;
            } else {
                $digits = str_replace('.', '', $trunc);
                $up = ((int) substr($digits, -1)) % 2 === 1;
            }
        }
        if ($up) {
            $ulp = $places > 0 ? '0.' . str_repeat('0', $places - 1) . '1' : '1';
            $trunc = bcadd($trunc, $ulp, $places);
        }
        $out = $trunc;
        if ($neg && bccomp($out, '0', $places) !== 0) {
            $out = '-' . $out;
        }
        return $out;
    }

    /** r2 في الأصل: تقريب لقرشين HALF_EVEN، والناتج دائماً بخانتين. */
    public static function r2($x): string
    {
        return self::round($x, 2);
    }

    /** quantize(0.0001) في الأصل (متوسط التكلفة والفئات). */
    public static function r4($x): string
    {
        return self::round($x, 4);
    }

    /** نسبة مئوية: (base × rate ÷ 100) ثم r2 — مطابق لـ Tax.amount و r2(gross * pct / 100). */
    public static function pct_amount($base, $rate): string
    {
        return self::r2(self::div(self::mul($base, $rate), '100'));
    }

    /** يحوّل لعدد خانات ثابت للعرض والمقارنة (مثل format(v, ".2f") في Python). */
    public static function fixed($x, int $places = 2): string
    {
        return self::round($x, $places);
    }

    /** تنسيق العرض: فواصل آلاف وخانتين، والسالب بين أقواس، والصفر شرطة (مثل فلتر money). */
    public static function money($v, int $places = 2, bool $dash_zero = true): string
    {
        $v = self::norm($v);
        if ($dash_zero && self::is_zero($v)) {
            return '-';
        }
        $r = self::round(self::abs($v), $places);
        $parts = explode('.', $r);
        $int = strrev(implode(',', str_split(strrev($parts[0]), 3)));
        $s = $places > 0 ? $int . '.' . str_pad($parts[1] ?? '', $places, '0') : $int;
        return self::cmp($v, '0') < 0 ? '(' . $s . ')' : $s;
    }

    /** فلتر qty: ثلاث خانات بدون أصفار زائدة. */
    public static function qty($v): string
    {
        $r = self::round(self::norm($v), 3);
        $neg = $r[0] === '-';
        $r = ltrim($r, '-');
        $parts = explode('.', $r);
        $int = strrev(implode(',', str_split(strrev($parts[0]), 3)));
        $frac = rtrim($parts[1] ?? '', '0');
        $s = $frac === '' ? $int : $int . '.' . $frac;
        return ($neg && $s !== '0') ? '-' . $s : $s;
    }

    /**
     * يتحقق من مدخل المستخدم كرقم عشري بحدود العمود (max_digits/decimal_places) كما يفعل DecimalField في Django.
     * يرجع النص الموحّد أو يرمي ERP_Validation_Error برسالة عربية.
     */
    public static function parse_input($raw, int $digits, int $places, string $label = ''): string
    {
        $raw = trim(str_replace([',', '٬', ' '], '', (string) $raw));
        $raw = strtr($raw, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6',
            '٧' => '7', '٨' => '8', '٩' => '9', '٫' => '.']);
        try {
            $v = self::norm($raw);
        } catch (InvalidArgumentException $e) {
            throw new ERP_Validation_Error(($label ? $label . ': ' : '') . 'أدخل رقماً صحيحاً.');
        }
        $abs = self::abs($v);
        $parts = explode('.', $abs);
        $frac = $parts[1] ?? '';
        $int = ltrim($parts[0], '0');
        if (strlen($frac) > $places) {
            throw new ERP_Validation_Error(($label ? $label . ': ' : '') . "تأكد أنه لا يوجد أكثر من {$places} خانات عشرية.");
        }
        if (strlen($int) > $digits - $places) {
            throw new ERP_Validation_Error(($label ? $label . ': ' : '') . 'الرقم أكبر من الحد المسموح به.');
        }
        return $v;
    }
}
