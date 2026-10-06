<?php
/**
 * النسخ الاحتياطي والاسترجاع:
 * - export(): JSON لكل جداول erp_ (بقيم نصية دقيقة).
 * - restore(): يقبل نسخة الإضافة أو نسخة Django (dumpdata) ويحمّلها على قاعدة فارغة فقط، داخل معاملة واحدة.
 */
defined('ABSPATH') || exit;

final class ERP_Backup
{
    const FORMAT = 'erp-metal-lines-backup';

    public static function export(): array
    {
        $tables = [];
        foreach (ERP_Schema::data_tables() as $t) {
            $tables[$t] = ERP_DB::rows('SELECT * FROM ' . ERP_DB::t($t) . ' ORDER BY id');
        }
        $out = ['format' => self::FORMAT, 'schema_version' => ERP_Schema::VERSION, 'plugin_version' => ERP_VERSION,
            'created_at' => gmdate('c'), 'tables' => $tables];
        ERP_Audit::log('backup', '', null, null, null, 'تنزيل نسخة احتياطية');
        return $out;
    }

    /** يحدد نوع الملف ويستورده. يرجع عدد السجلات لكل جدول. */
    public static function restore(string $json): array
    {
        $data = json_decode($json, true);
        if (!is_array($data)) {
            throw new ERP_Validation_Error('الملف ليس نسخة احتياطية صالحة (JSON غير سليم).');
        }
        if (isset($data['format']) && $data['format'] === self::FORMAT) {
            $tables = $data['tables'];
            $source = 'نسخة الإضافة';
        } elseif (array_is_list($data) && isset($data[0]['model'])) {
            $tables = self::from_django($data);
            $source = 'نسخة Django';
        } else {
            throw new ERP_Validation_Error('صيغة الملف غير معروفة.');
        }
        return self::load($tables, $source);
    }

    /** يحوّل صيغة dumpdata (Django) إلى صفوف جداول الإضافة. */
    public static function from_django(array $items): array
    {
        $schema = ERP_DB::schema()['tables'];
        $meta = ERP_DB::meta();
        $label_to_table = [];
        foreach ($schema as $name => $def) {
            $label_to_table[strtolower($def['app'] . '.' . $def['model'])] = $name;
        }
        $users = [];
        $tables = [];
        foreach ($items as $it) {
            $label = strtolower($it['model']);
            if (!isset($label_to_table[$label])) {
                continue; // جداول Django الداخلية (المستخدمون، الجلسات...) لا تُنقل
            }
            $t = $label_to_table[$label];
            $row = ['id' => (int) $it['pk']];
            foreach ($meta[$t]['fields'] as $fname => $f) {
                if ($f['type'] === 'id' || !array_key_exists($fname, $it['fields'])) {
                    continue;
                }
                $v = $it['fields'][$fname];
                if ($f['type'] === 'fk' && ($f['target'] ?? '') === 'wp_users') {
                    // natural key = [username] ⇒ نفس اسم الدخول في WordPress إن وُجد
                    $login = is_array($v) ? (string) ($v[0] ?? '') : '';
                    if (!isset($users[$login])) {
                        $u = $login !== '' ? get_user_by('login', $login) : false;
                        $users[$login] = $u ? (int) $u->ID : null;
                    }
                    $v = $users[$login];
                } elseif ($f['type'] === 'datetime' && $v !== null) {
                    $ts = new DateTimeImmutable($v);
                    $v = $ts->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
                } elseif ($f['type'] === 'bool') {
                    $v = $v ? 1 : 0;
                }
                $row[$f['column']] = $v;
            }
            $tables[$t][] = $row;
        }
        return $tables;
    }

    private static function load(array $tables, string $source): array
    {
        if (!ERP_Seed::is_empty()) {
            throw new ERP_Validation_Error('الاسترجاع مسموح على قاعدة بيانات فارغة فقط. لا توجد أي بيانات محاسبية حالياً يجب أن تكون صفراً.');
        }
        $known = ERP_Schema::data_tables();
        foreach (array_keys($tables) as $t) {
            if (!in_array($t, $known, true)) {
                throw new ERP_Validation_Error('جدول غير معروف في الملف: ' . $t);
            }
        }
        $counts = [];
        $db = ERP_DB::wpdb();
        ERP_DB::transaction(function () use ($tables, $known, &$counts, $db, $source) {
            // سجل الشركة الافتراضي (إن وُجد) يُستبدل بالمستورد
            if (!empty($tables['company'])) {
                ERP_DB::query('DELETE FROM ' . ERP_DB::t('company'));
            }
            $db->query('SET FOREIGN_KEY_CHECKS = 0');
            try {
                foreach ($known as $t) {
                    $counts[$t] = 0;
                    foreach ($tables[$t] ?? [] as $row) {
                        ERP_DB::insert($t, $row, true);
                        $counts[$t]++;
                    }
                }
            } finally {
                $db->query('SET FOREIGN_KEY_CHECKS = 1');
            }
            // تحقق صارم من سلامة كل المراجع بعد التحميل — أي مرجع يتيم يلغي الاسترجاع كله
            foreach (ERP_Schema::all_tables() as $name => $def) {
                foreach ($def['fks'] as $fk) {
                    $orphans = (int) ERP_DB::value(sprintf(
                        'SELECT COUNT(*) FROM %1$s c LEFT JOIN %2$s p ON p.id = c.%3$s WHERE c.%3$s IS NOT NULL AND p.id IS NULL',
                        ERP_DB::t($name), ERP_DB::t($fk['table']), $fk['column']));
                    if ($orphans) {
                        throw new ERP_Validation_Error("الملف به {$orphans} مرجع غير موجود في {$name}.{$fk['column']} — تم إلغاء الاسترجاع.");
                    }
                }
            }
            ERP_Accounts::flush();
            ERP_Audit::log('restore', '', null, null, $counts, 'استرجاع بيانات من ' . $source);
        });
        return $counts;
    }
}
