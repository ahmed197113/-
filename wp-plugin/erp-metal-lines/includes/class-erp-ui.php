<?php
/**
 * أدوات الواجهة: الهروب (escaping)، الروابط، الرسائل، تنسيق الأرقام، النماذج والتحقق على السيرفر.
 * كل مخرج يمر على esc_html/esc_attr/esc_url، وكل مدخل على sanitize + تحقق نوع ونطاق.
 */
defined('ABSPATH') || exit;

function erp_e($v): string
{
    return esc_html((string) $v);
}

function erp_a($v): string
{
    return esc_attr((string) $v);
}

function erp_url(string $path = '/', array $query = []): string
{
    $u = home_url($path);
    return $query ? add_query_arg(array_map('rawurlencode', $query), $u) : $u;
}

function erp_money($v): string
{
    return ERP_Money::money($v === null ? '0' : $v);
}

function erp_money0($v): string
{
    return ERP_Money::money($v === null ? '0' : $v, 2, false);
}

function erp_qty($v): string
{
    return ERP_Money::qty($v === null ? '0' : $v);
}

function erp_date($v): string
{
    return $v ? str_replace('-', '/', substr((string) $v, 0, 10)) : '';
}

function erp_state_badge(string $state): string
{
    $map = ['draft' => ['secondary', 'مسودة'], 'posted' => ['success', 'مرحّل'], 'cancelled' => ['danger', 'ملغي']];
    [$c, $t] = $map[$state] ?? ['light', $state];
    return '<span class="badge text-bg-' . erp_a($c) . '">' . erp_e($t) . '</span>';
}

final class ERP_UI
{
    const NONCE = 'erp';

    public static function nonce_field(): string
    {
        return wp_nonce_field(self::NONCE, '_erp_nonce', false, false);
    }

    // ------------------------------------------------------------------ الرسائل (flash)
    public static function flash(string $level, string $msg): void
    {
        $key = 'erp_flash_' . get_current_user_id();
        $list = get_transient($key) ?: [];
        $list[] = [$level, $msg];
        set_transient($key, $list, 300);
    }

    public static function take_flash(): array
    {
        $key = 'erp_flash_' . get_current_user_id();
        $list = get_transient($key) ?: [];
        delete_transient($key);
        return $list;
    }

    // ------------------------------------------------------------------ قراءة المدخلات
    public static function get(string $key, string $default = ''): string
    {
        return isset($_GET[$key]) ? sanitize_text_field(wp_unslash($_GET[$key])) : $default;
    }

    public static function post(string $key, string $default = ''): string
    {
        return isset($_POST[$key]) ? sanitize_text_field(wp_unslash($_POST[$key])) : $default;
    }

    public static function post_textarea(string $key): string
    {
        return isset($_POST[$key]) ? sanitize_textarea_field(wp_unslash($_POST[$key])) : '';
    }

    public static function date_param(string $key, string $default): string
    {
        $v = self::get($key);
        return self::valid_date($v) ? $v : $default;
    }

    public static function valid_date(string $v): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
            return false;
        }
        [$y, $m, $d] = array_map('intval', explode('-', $v));
        return checkdate($m, $d, $y);
    }

    public static function today(): string
    {
        return current_time('Y-m-d');
    }

    // ------------------------------------------------------------------ النماذج المبنية على الميتا
    /**
     * يتحقق من حقول نموذج ويرجع [القيم النظيفة، الأخطاء].
     * $fields: field_name => ['choices_from' => [id=>label] للـ FK, 'required' => bool لتجاوز الافتراضي]
     */
    public static function clean_form(string $table, array $fields, string $prefix = ''): array
    {
        $values = [];
        $errors = [];
        foreach ($fields as $name => $opts) {
            $f = ERP_DB::field($table, $name);
            $key = $prefix . $name;
            $required = $opts['required'] ?? (!$f['blank'] && $f['type'] !== 'bool');
            $col = $f['column'];
            $raw = isset($_POST[$key]) ? wp_unslash($_POST[$key]) : null;
            if (is_array($raw)) {
                $errors[$name] = 'قيمة غير صالحة.';
                continue;
            }
            switch ($f['type']) {
                case 'bool':
                    $values[$col] = !empty($raw);
                    break;
                case 'text':
                    $values[$col] = sanitize_textarea_field((string) $raw);
                    if ($required && trim($values[$col]) === '') {
                        $errors[$name] = 'هذا الحقل مطلوب.';
                    }
                    break;
                case 'char':
                    $v = trim(sanitize_text_field((string) $raw));
                    if (isset($f['choices'])) {
                        if ($v === '' && !$required) {
                            $values[$col] = $f['default'] ?? '';
                        } elseif (!isset($f['choices'][$v])) {
                            $errors[$name] = $v === '' ? 'هذا الحقل مطلوب.' : 'اختر قيمة صحيحة.';
                        } else {
                            $values[$col] = $v;
                        }
                        break;
                    }
                    if ($name === 'email' && $v !== '' && !is_email($v)) {
                        $errors[$name] = 'أدخل بريداً إلكترونياً صحيحاً.';
                    }
                    if ($required && $v === '') {
                        $errors[$name] = 'هذا الحقل مطلوب.';
                    } elseif (mb_strlen($v) > (int) $f['max_length']) {
                        $errors[$name] = 'تأكد أن عدد الحروف لا يزيد عن ' . $f['max_length'] . '.';
                    }
                    $values[$col] = $v;
                    break;
                case 'decimal':
                    $v = trim((string) $raw);
                    if ($v === '') {
                        if ($required) {
                            $errors[$name] = 'هذا الحقل مطلوب.';
                        } else {
                            $values[$col] = $f['default'] ?? null;
                        }
                        break;
                    }
                    try {
                        $values[$col] = ERP_Money::parse_input($v, (int) $f['digits'], (int) $f['places']);
                    } catch (ERP_Validation_Error $e) {
                        $errors[$name] = $e->getMessage();
                    }
                    break;
                case 'int':
                    $v = trim((string) $raw);
                    if ($v === '') {
                        if ($required) {
                            $errors[$name] = 'هذا الحقل مطلوب.';
                        } else {
                            $values[$col] = $f['default'] ?? 0;
                        }
                    } elseif (!ctype_digit($v)) {
                        $errors[$name] = 'أدخل عدداً صحيحاً موجباً.';
                    } else {
                        $values[$col] = (int) $v;
                    }
                    break;
                case 'date':
                    $v = trim((string) $raw);
                    if ($v === '') {
                        if ($required) {
                            $errors[$name] = 'هذا الحقل مطلوب.';
                        } else {
                            $values[$col] = null;
                        }
                    } elseif (!self::valid_date($v)) {
                        $errors[$name] = 'أدخل تاريخاً صحيحاً.';
                    } else {
                        $values[$col] = $v;
                    }
                    break;
                case 'fk':
                    $v = trim((string) $raw);
                    if ($v === '') {
                        if ($required) {
                            $errors[$name] = 'هذا الحقل مطلوب.';
                        } else {
                            $values[$col] = null;
                        }
                    } elseif (!ctype_digit($v) || !isset($opts['choices_from'][(int) $v])) {
                        $errors[$name] = 'اختر قيمة صحيحة. الاختيار غير متاح.';
                    } else {
                        $values[$col] = (int) $v;
                    }
                    break;
            }
        }
        return [$values, $errors];
    }

    /** يرسم حقل نموذج بنفس شكل generic/_field.html. */
    public static function field_html(string $table, string $name, array $opts, $value, ?string $error, string $prefix = '',
                                      string $cls = 'col-md-4', bool $bare = false): string
    {
        $f = ERP_DB::field($table, $name);
        $key = $prefix . $name;
        $id = 'id_' . $key;
        $label = $opts['label'] ?? $f['label'];
        $required = $opts['required'] ?? (!$f['blank'] && $f['type'] !== 'bool');
        $input = '';
        $type = $f['type'];
        if ($type === 'bool') {
            $input = '<input type="checkbox" class="form-check-input" name="' . erp_a($key) . '" id="' . erp_a($id) . '" value="1"'
                . ($value ? ' checked' : '') . '>';
        } elseif ($type === 'text') {
            $input = '<textarea class="form-control form-control-sm" rows="2" name="' . erp_a($key) . '" id="' . erp_a($id) . '">'
                . esc_textarea((string) $value) . '</textarea>';
        } elseif ($type === 'fk' || isset($f['choices'])) {
            $choices = $type === 'fk' ? ($opts['choices_from'] ?? []) : $f['choices'];
            $input = '<select class="form-select form-select-sm' . ($type === 'fk' ? ' searchable' : '') . '" name="'
                . erp_a($key) . '" id="' . erp_a($id) . '">';
            if ($type === 'fk' || !$required) {
                $input .= '<option value="">---------</option>';
            }
            foreach ($choices as $k => $lbl) {
                $input .= '<option value="' . erp_a($k) . '"' . ((string) $value === (string) $k ? ' selected' : '') . '>'
                    . erp_e($lbl) . '</option>';
            }
            $input .= '</select>';
        } else {
            $attrs = ['type' => 'text', 'class' => 'form-control form-control-sm'];
            if ($type === 'date') {
                $attrs['type'] = 'date';
            } elseif ($type === 'decimal') {
                $attrs['class'] .= ' num';
                $attrs['inputmode'] = 'decimal';
            } elseif ($type === 'int') {
                $attrs['type'] = 'number';
                $attrs['min'] = '0';
            } elseif ($name === 'email') {
                $attrs['type'] = 'email';
            }
            if (isset($f['max_length'])) {
                $attrs['maxlength'] = $f['max_length'];
            }
            $html = '';
            foreach ($attrs as $k => $v) {
                $html .= ' ' . $k . '="' . erp_a($v) . '"';
            }
            $input = '<input' . $html . ' name="' . erp_a($key) . '" id="' . erp_a($id) . '" value="' . erp_a($value ?? '') . '">';
        }
        $err = $error ? '<ul class="errorlist"><li>' . erp_e($error) . '</li></ul>' : '';
        if ($bare) {
            return $input . $err;
        }
        $help = $f['help'] ? '<div class="form-text">' . erp_e($f['help']) . '</div>' : '';
        if ($type === 'bool') {
            return '<div class="' . erp_a($cls) . '"><div class="form-check mt-4">' . $input . ' <label class="form-check-label" for="'
                . erp_a($id) . '">' . erp_e($label) . '</label></div>' . $help . $err . '</div>';
        }
        return '<div class="' . erp_a($cls) . '"><label class="form-label small mb-1" for="' . erp_a($id) . '">' . erp_e($label)
            . ($required ? ' <span class="text-danger">*</span>' : '') . '</label>' . $input . $help . $err . '</div>';
    }

    /** خيارات FK: id => نص العرض. */
    public static function options(string $table, string $where = '1=1', array $args = [], string $label = 'name',
                                   string $order = 'id'): array
    {
        $out = [];
        foreach (ERP_DB::rows('SELECT * FROM ' . ERP_DB::t($table) . " WHERE {$where} ORDER BY {$order}", $args) as $r) {
            $out[(int) $r['id']] = is_callable($label) ? $label($r) : $r[$label];
        }
        return $out;
    }

    public static function account_options(string $where = 'is_group = 0 AND active = 1', array $args = []): array
    {
        return self::options('account', $where, $args, function ($a) {
            return ERP_Accounts::str($a);
        }, 'code');
    }

    public static function code_name_options(string $table, string $where = '1=1'): array
    {
        return self::options($table, $where, [], function ($r) {
            return $r['code'] . ' - ' . $r['name'];
        }, 'code');
    }

    // ------------------------------------------------------------------ مجموعات السطور (formsets) بنفس أسماء Django
    /** يقرأ صفوف formset من الطلب: يرجع قائمة [index => [field => raw], 'DELETE' => bool, 'id' => ...] */
    public static function formset_rows(string $prefix, array $fields): array
    {
        $total = (int) self::post($prefix . '-TOTAL_FORMS', '0');
        $total = max(0, min($total, 1000));
        $rows = [];
        for ($i = 0; $i < $total; $i++) {
            $row = ['_index' => $i, 'DELETE' => !empty($_POST["{$prefix}-{$i}-DELETE"])];
            $changed = false;
            foreach ($fields as $f) {
                $v = isset($_POST["{$prefix}-{$i}-{$f}"]) ? trim(sanitize_text_field(wp_unslash($_POST["{$prefix}-{$i}-{$f}"]))) : '';
                $row[$f] = $v;
                if ($v !== '' && $v !== '0' && $v !== '0.00' && $v !== '100') {
                    $changed = true;
                }
            }
            $row['_empty'] = !$changed;
            $rows[] = $row;
        }
        return $rows;
    }
}
