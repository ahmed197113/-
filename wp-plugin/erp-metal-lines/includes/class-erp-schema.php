<?php
/**
 * إنشاء الجداول وترقيتها (dbDelta + مفاتيح أجنبية) مع رقم إصدار للـ schema.
 * الجداول الأساسية مولّدة من كود Django المرجعي (includes/generated/schema.php).
 */
defined('ABSPATH') || exit;

final class ERP_Schema
{
    /** يزيد مع كل تغيير في بنية الجداول، وتُضاف خطوة ترقية في migrations(). */
    const VERSION = 1;
    const OPTION = 'erp_schema_version';

    /** جداول خاصة بالإضافة (ليست في Django). */
    public static function extra_tables(): array
    {
        return [
            'audit_log' => [
                'columns' => [
                    'id bigint(20) NOT NULL AUTO_INCREMENT',
                    'created_at datetime(6) NOT NULL',
                    'user_id bigint(20) unsigned NULL',
                    "user_login varchar(60) NOT NULL DEFAULT ''",
                    "action varchar(20) NOT NULL",
                    "table_name varchar(60) NOT NULL DEFAULT ''",
                    'record_id bigint(20) NULL',
                    "summary varchar(300) NOT NULL DEFAULT ''",
                    'before_data longtext NULL',
                    'after_data longtext NULL',
                    "ip varchar(45) NOT NULL DEFAULT ''",
                ],
                'uniques' => [],
                'keys' => ['KEY created_at (created_at)', 'KEY table_record (table_name,record_id)', 'KEY user_id (user_id)'],
                'fks' => [],
            ],
            'error_log' => [
                'columns' => [
                    'id bigint(20) NOT NULL AUTO_INCREMENT',
                    'created_at datetime(6) NOT NULL',
                    'user_id bigint(20) unsigned NULL',
                    'message text NOT NULL',
                    'context longtext NULL',
                ],
                'uniques' => [],
                'keys' => ['KEY created_at (created_at)'],
                'fks' => [],
            ],
        ];
    }

    public static function all_tables(): array
    {
        $s = ERP_DB::schema();
        $out = [];
        foreach ($s['order'] as $name) {
            $out[$name] = $s['tables'][$name];
        }
        return $out + self::extra_tables();
    }

    /** أسماء جداول البيانات المحاسبية بترتيب الاعتماد (بدون السجلات). */
    public static function data_tables(): array
    {
        return ERP_DB::schema()['order'];
    }

    public static function create_sql(string $name, array $def): string
    {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $lines = $def['columns'];
        $lines[] = 'PRIMARY KEY  (id)';
        foreach (array_merge($def['uniques'], $def['keys']) as $k) {
            $lines[] = $k;
        }
        return 'CREATE TABLE ' . ERP_DB::t($name) . " (\n" . implode(",\n", $lines) . "\n) ENGINE=InnoDB {$charset};";
    }

    public static function install(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $installed = (int) get_option(self::OPTION, 0);
        foreach (self::all_tables() as $name => $def) {
            dbDelta(self::create_sql($name, $def));
        }
        // dbDelta لا يدعم المفاتيح الأجنبية ⇒ تُضاف يدوياً إن لم تكن موجودة
        foreach (self::all_tables() as $name => $def) {
            foreach ($def['fks'] as $fk) {
                $cname = substr('fk_' . $name . '_' . $fk['column'], 0, 60);
                $exists = $wpdb->get_var($wpdb->prepare(
                    'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() '
                    . 'AND TABLE_NAME = %s AND CONSTRAINT_NAME = %s AND CONSTRAINT_TYPE = %s',
                    ERP_DB::t($name), $cname, 'FOREIGN KEY'
                ));
                if (!$exists) {
                    $wpdb->query(sprintf(
                        'ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s (id) ON DELETE %s',
                        ERP_DB::t($name), $cname, $fk['column'], ERP_DB::t($fk['table']), $fk['on_delete']
                    ));
                    if ($wpdb->last_error) {
                        ERP_Log::error('FK: ' . $wpdb->last_error, ['table' => $name, 'fk' => $fk]);
                        $wpdb->last_error = '';
                    }
                }
            }
        }
        self::migrations($installed);
        $missing = self::missing_tables();
        if ($missing) {
            ERP_Log::error('تعذر إنشاء الجداول: ' . implode(', ', $missing));
            throw new RuntimeException('تعذر إنشاء جداول قاعدة البيانات: ' . implode(', ', $missing));
        }
        update_option(self::OPTION, self::VERSION, false);
    }

    /** خطوات الترقية المرتبة من إصدار لإصدار (تُكتب هنا عند أي تغيير مستقبلي). */
    private static function migrations(int $from): void
    {
        // مثال للمستقبل: if ($from < 2) { ... ALTER ... }
    }

    public static function maybe_upgrade(): void
    {
        if ((int) get_option(self::OPTION, 0) < self::VERSION) {
            self::install();
        }
    }

    /** الجداول غير الموجودة فعلياً في قاعدة البيانات. */
    public static function missing_tables(): array
    {
        global $wpdb;
        $missing = [];
        foreach (array_keys(self::all_tables()) as $name) {
            if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', ERP_DB::t($name))) !== ERP_DB::t($name)) {
                $missing[] = $name;
            }
        }
        return $missing;
    }

    /** للتحقق في الاختبارات: هل كل المفاتيح الأجنبية موجودة؟ */
    public static function missing_foreign_keys(): array
    {
        global $wpdb;
        $missing = [];
        foreach (self::all_tables() as $name => $def) {
            foreach ($def['fks'] as $fk) {
                $cname = substr('fk_' . $name . '_' . $fk['column'], 0, 60);
                $n = $wpdb->get_var($wpdb->prepare(
                    'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() '
                    . 'AND TABLE_NAME = %s AND CONSTRAINT_NAME = %s', ERP_DB::t($name), $cname));
                if (!$n) {
                    $missing[] = $cname;
                }
            }
        }
        return $missing;
    }
}

final class ERP_Log
{
    /** يسجّل الخطأ داخلياً في جدول erp_error_log (بدون عرضه للمستخدم). */
    public static function error(string $message, array $context = []): void
    {
        global $wpdb;
        $saved = $wpdb->last_error;
        $wpdb->insert($wpdb->prefix . 'erp_error_log', [
            'created_at' => gmdate('Y-m-d H:i:s'),
            'user_id' => get_current_user_id() ?: null,
            'message' => mb_substr($message, 0, 5000),
            'context' => $context ? wp_json_encode($context, JSON_UNESCAPED_UNICODE) : null,
        ]);
        $wpdb->last_error = $saved;
    }
}

final class ERP_Audit
{
    /** يسجّل عملية في سجل التدقيق (للقراءة فقط — لا توجد أي دالة للحذف أو التعديل). */
    public static function log(string $action, string $table = '', $record_id = null, $before = null, $after = null,
                               string $summary = ''): void
    {
        $user = wp_get_current_user();
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
        $db = ERP_DB::wpdb();
        $ok = $db->insert(ERP_DB::t('audit_log'), [
            'created_at' => gmdate('Y-m-d H:i:s'),
            'user_id' => $user->ID ? (int) $user->ID : null,
            'user_login' => (string) $user->user_login,
            'action' => $action,
            'table_name' => $table,
            'record_id' => $record_id === null ? null : (int) $record_id,
            'summary' => mb_substr($summary, 0, 300),
            'before_data' => $before === null ? null : wp_json_encode($before, JSON_UNESCAPED_UNICODE),
            'after_data' => $after === null ? null : wp_json_encode($after, JSON_UNESCAPED_UNICODE),
            'ip' => $ip,
        ]);
        if ($ok === false) {
            // فشل التدقيق يُلغي العملية كلها (لا عملية بدون أثر)
            throw new ERP_Db_Error('تعذر تسجيل العملية في سجل التدقيق: ' . $db->last_error);
        }
    }
}
