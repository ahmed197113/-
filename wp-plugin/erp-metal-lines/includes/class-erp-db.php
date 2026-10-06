<?php
/**
 * طبقة قاعدة البيانات: أسماء الجداول، المعاملات، الإدخال/التعديل الآمن.
 * كل الاستعلامات عبر $wpdb->prepare، وأي خطأ SQL يتحول لاستثناء يُلغي المعاملة بالكامل.
 */
defined('ABSPATH') || exit;

class ERP_Validation_Error extends Exception
{
    /** @var array<string,string> أخطاء على حقول بعينها */
    public $fields = [];

    public function __construct(string $message = '', array $fields = [])
    {
        parent::__construct($message);
        $this->fields = $fields;
    }
}

class ERP_Db_Error extends RuntimeException
{
}

final class ERP_DB
{
    private static $schema = null;
    private static $meta = null;
    private static $depth = 0;

    public static function wpdb(): wpdb
    {
        global $wpdb;
        return $wpdb;
    }

    public static function schema(): array
    {
        if (self::$schema === null) {
            self::$schema = require ERP_PLUGIN_DIR . 'includes/generated/schema.php';
        }
        return self::$schema;
    }

    public static function meta(): array
    {
        if (self::$meta === null) {
            self::$meta = require ERP_PLUGIN_DIR . 'includes/generated/meta.php';
        }
        return self::$meta;
    }

    /** اسم الجدول الكامل: {prefix}erp_<name> */
    public static function t(string $name): string
    {
        return self::wpdb()->prefix . 'erp_' . $name;
    }

    /** وصف حقل من ملف الميتا المولّد. */
    public static function field(string $table, string $field): array
    {
        $m = self::meta();
        return $m[$table]['fields'][$field] ?? [];
    }

    public static function label(string $table, string $field): string
    {
        return self::field($table, $field)['label'] ?? $field;
    }

    public static function choices(string $table, string $field): array
    {
        return self::field($table, $field)['choices'] ?? [];
    }

    public static function display(string $table, string $field, $value): string
    {
        $c = self::choices($table, $field);
        return $c[(string) $value] ?? (string) $value;
    }

    // ------------------------------------------------------------------ تنفيذ الاستعلامات
    private static function check(string $sql = ''): void
    {
        $db = self::wpdb();
        if ($db->last_error !== '') {
            $err = $db->last_error;
            $db->last_error = '';
            ERP_Log::error('SQL: ' . $err, ['sql' => mb_substr($sql ?: (string) $db->last_query, 0, 2000)]);
            if (stripos($err, 'foreign key constraint fails') !== false) {
                throw new ERP_Validation_Error('لا يمكن تنفيذ العملية لوجود حركات أو سجلات مرتبطة.');
            }
            if (stripos($err, 'Duplicate entry') !== false) {
                throw new ERP_Validation_Error('القيمة مستخدمة من قبل (مكررة) ويجب أن تكون فريدة.');
            }
            throw new ERP_Db_Error($err);
        }
    }

    /** يجهّز الاستعلام بالمعاملات (إن وُجدت) — المعاملات دائماً عبر prepare. */
    public static function sql(string $sql, array $args = []): string
    {
        return $args ? self::wpdb()->prepare($sql, $args) : $sql;
    }

    /** ينفّذ دالة wpdb مع كتم طباعة أخطاء SQL للمستخدم (تُسجَّل داخلياً في check()). */
    private static function run(callable $fn)
    {
        $db = self::wpdb();
        $prev = $db->suppress_errors(true);
        try {
            return $fn($db);
        } finally {
            $db->suppress_errors($prev);
        }
    }

    public static function query(string $sql, array $args = [])
    {
        $q = self::sql($sql, $args);
        $r = self::run(function ($db) use ($q) {
            return $db->query($q);
        });
        self::check($q);
        return $r;
    }

    public static function rows(string $sql, array $args = []): array
    {
        $q = self::sql($sql, $args);
        $r = self::run(function ($db) use ($q) {
            return $db->get_results($q, ARRAY_A);
        });
        self::check($q);
        return $r ?: [];
    }

    public static function row(string $sql, array $args = []): ?array
    {
        $q = self::sql($sql, $args);
        $r = self::run(function ($db) use ($q) {
            return $db->get_row($q, ARRAY_A);
        });
        self::check($q);
        return $r ?: null;
    }

    public static function value(string $sql, array $args = [])
    {
        $q = self::sql($sql, $args);
        $r = self::run(function ($db) use ($q) {
            return $db->get_var($q);
        });
        self::check($q);
        return $r;
    }

    public static function col(string $sql, array $args = []): array
    {
        $q = self::sql($sql, $args);
        $r = self::run(function ($db) use ($q) {
            return $db->get_col($q);
        });
        self::check($q);
        return $r ?: [];
    }

    public static function get(string $table, $id): ?array
    {
        return self::row('SELECT * FROM ' . self::t($table) . ' WHERE id = %d', [(int) $id]);
    }

    // ------------------------------------------------------------------ تجهيز القيم قبل الكتابة
    /**
     * يحوّل القيم لصيغة التخزين ويقرّب العشري لخانات العمود بـ HALF_EVEN (سلوك Django)،
     * ويتأكد من عدم وجود أعمدة غير معروفة.
     */
    public static function prepare_values(string $table, array $data): array
    {
        $fields = [];
        foreach (self::meta()[$table]['fields'] as $f) {
            $fields[$f['column']] = $f;
        }
        $out = [];
        foreach ($data as $col => $v) {
            if (!isset($fields[$col])) {
                throw new ERP_Db_Error("عمود غير معروف {$table}.{$col}");
            }
            $f = $fields[$col];
            if ($v === null) {
                $out[$col] = null;
                continue;
            }
            switch ($f['type']) {
                case 'decimal':
                    $out[$col] = ERP_Money::round(ERP_Money::norm($v), (int) $f['places']);
                    break;
                case 'bool':
                    $out[$col] = $v ? 1 : 0;
                    break;
                case 'fk':
                case 'id':
                case 'int':
                    $out[$col] = (int) $v;
                    break;
                case 'char':
                    $s = (string) $v;
                    if (mb_strlen($s) > (int) $f['max_length']) {
                        throw new ERP_Validation_Error($f['label'] . ': النص أطول من ' . $f['max_length'] . ' حرف.');
                    }
                    $out[$col] = $s;
                    break;
                default:
                    $out[$col] = (string) $v;
            }
        }
        return $out;
    }

    private static function formats(array $values): array
    {
        $f = [];
        foreach ($values as $v) {
            $f[] = is_int($v) ? '%d' : '%s';
        }
        return $f;
    }

    /** $raw = true: إدخال كما هو بدون تعبئة التواريخ الآلية (الاسترجاع — مثل loaddata في Django). */
    public static function insert(string $table, array $data, bool $raw = false): int
    {
        if (!$raw) {
            $data = self::fill_timestamps($table, $data, true);
        }
        $values = self::prepare_values($table, $data);
        $ok = self::run(function ($db) use ($table, $values) {
            return $db->insert(self::t($table), $values, self::formats($values));
        });
        self::check();
        if ($ok === false) {
            throw new ERP_Db_Error('تعذر الحفظ في ' . $table);
        }
        return (int) self::wpdb()->insert_id;
    }

    public static function update(string $table, int $id, array $data): void
    {
        $data = self::fill_timestamps($table, $data, false);
        $values = self::prepare_values($table, $data);
        if (!$values) {
            return;
        }
        $ok = self::run(function ($db) use ($table, $values, $id) {
            return $db->update(self::t($table), $values, ['id' => $id], self::formats($values), ['%d']);
        });
        self::check();
        if ($ok === false) {
            throw new ERP_Db_Error('تعذر التعديل في ' . $table);
        }
    }

    public static function delete(string $table, int $id): void
    {
        self::query('DELETE FROM ' . self::t($table) . ' WHERE id = %d', [$id]);
    }

    private static function fill_timestamps(string $table, array $data, bool $creating): array
    {
        $now = gmdate('Y-m-d H:i:s.') . sprintf('%06d', (int) (microtime(true) * 1e6) % 1000000);
        foreach (self::meta()[$table]['fields'] as $f) {
            if (!empty($f['auto_now']) || ($creating && !empty($f['auto_now_add']) && !isset($data[$f['column']]))) {
                $data[$f['column']] = $now;
            }
        }
        return $data;
    }

    // ------------------------------------------------------------------ المعاملات
    /**
     * يشغّل الدالة داخل معاملة. المعاملات المتداخلة تستخدم SAVEPOINT.
     * أي استثناء ⇒ ROLLBACK كامل (أو للنقطة) ثم يُعاد رمي الاستثناء.
     */
    public static function transaction(callable $fn)
    {
        $db = self::wpdb();
        $level = self::$depth;
        if ($level === 0) {
            $db->query('START TRANSACTION');
        } else {
            $db->query('SAVEPOINT erp_sp' . $level);
        }
        self::check();
        self::$depth++;
        try {
            $result = $fn();
            self::$depth--;
            if ($level === 0) {
                $db->query('COMMIT');
            } else {
                $db->query('RELEASE SAVEPOINT erp_sp' . $level);
            }
            self::check();
            return $result;
        } catch (Throwable $e) {
            self::$depth = $level;
            $db->last_error = '';
            if ($level === 0) {
                $db->query('ROLLBACK');
            } else {
                $db->query('ROLLBACK TO SAVEPOINT erp_sp' . $level);
            }
            throw $e;
        }
    }

    public static function in_transaction(): bool
    {
        return self::$depth > 0;
    }
}
