<?php
/**
 * أوامر الإدارة: setup_company (التهيئة) و reset_data (المسح مع الإبقاء على الإعدادات).
 * نقل حرفي لـ accounting/seed.py و management/commands/reset_data.py.
 */
defined('ABSPATH') || exit;

final class ERP_Seed
{
    private static $data = null;

    public static function data(): array
    {
        if (self::$data === null) {
            self::$data = require ERP_PLUGIN_DIR . 'includes/generated/seed.php';
        }
        return self::$data;
    }

    /** seed_basics(): idempotent — يمكن تشغيلها أكثر من مرة دون تكرار. */
    public static function setup_company(?string $company_name = null): void
    {
        ERP_DB::transaction(function () use ($company_name) {
            $d = self::data();
            $company = ERP_Company::get();
            if ($company_name) {
                ERP_DB::update('company', (int) $company['id'], ['name' => $company_name]);
            }
            $codes = array_column($d['coa'], 0);
            $codeset = array_flip($codes);
            $groups = [];
            foreach ($codes as $code) {
                for ($i = 1; $i < strlen($code); $i++) {
                    if (isset($codeset[substr($code, 0, $i)])) {
                        $groups[substr($code, 0, $i)] = true;
                    }
                }
            }
            $accounts = [];
            foreach ($d['coa'] as [$code, $name, $type, $kind]) {
                $parent = null;
                for ($i = strlen($code) - 1; $i > 0; $i--) {
                    if (isset($accounts[substr($code, 0, $i)])) {
                        $parent = $accounts[substr($code, 0, $i)];
                        break;
                    }
                }
                $existing = ERP_Accounts::by_code($code);
                if ($existing) {
                    $accounts[$code] = (int) $existing['id'];
                } else {
                    $accounts[$code] = ERP_DB::insert('account', [
                        'code' => $code, 'name' => $name, 'type' => $type, 'kind' => $kind, 'parent_id' => $parent,
                        'is_group' => isset($groups[$code]), 'active' => true, 'notes' => '',
                    ]);
                }
            }
            ERP_Accounts::flush();
            foreach ($d['mappings'] as $role => $code) {
                $exists = ERP_DB::value('SELECT id FROM ' . ERP_DB::t('account_mapping') . ' WHERE role = %s', [$role]);
                if (!$exists) {
                    ERP_DB::insert('account_mapping', ['role' => $role, 'account_id' => (int) ERP_Accounts::by_code($code)['id']]);
                }
            }
            foreach ($d['taxes'] as [$name, $kind, $rate, $scope]) {
                if (!ERP_DB::value('SELECT id FROM ' . ERP_DB::t('tax') . ' WHERE name = %s', [$name])) {
                    ERP_DB::insert('tax', ['name' => $name, 'kind' => $kind, 'rate' => $rate, 'scope' => $scope, 'active' => true]);
                }
            }
            foreach ($d['templates'] as $tpl) {
                if (ERP_DB::value('SELECT id FROM ' . ERP_DB::t('journal_template') . ' WHERE name = %s', [$tpl['name']])) {
                    continue;
                }
                $tid = ERP_DB::insert('journal_template', ['name' => $tpl['name'], 'memo' => $tpl['memo'],
                    'ask_partner' => $tpl['ask_partner'], 'ask_project' => $tpl['ask_project'], 'active' => true]);
                foreach ($tpl['lines'] as [$code, $side, $pct, $label, $up, $uprj]) {
                    ERP_DB::insert('journal_template_line', ['template_id' => $tid,
                        'account_id' => (int) ERP_Accounts::by_code($code)['id'], 'side' => $side, 'percent' => $pct,
                        'label' => $label, 'use_partner' => $up, 'use_project' => $uprj]);
                }
            }
            $wh = $d['default_warehouse'];
            if (!ERP_DB::value('SELECT id FROM ' . ERP_DB::t('warehouse') . ' WHERE code = %s', [$wh['code']])) {
                ERP_DB::insert('warehouse', ['code' => $wh['code'], 'name' => $wh['name'], 'active' => true]);
            }
            ERP_Audit::log('setup', '', null, null, null, 'تهيئة النظام (شجرة الحسابات والضرائب والقيود الجاهزة)');
        });
    }

    /** reset_data: يمسح الحركات والبيانات ويبقي الإعدادات (نفس قائمة الأصل وترتيبها). */
    public static function reset_data(): void
    {
        ERP_DB::transaction(function () {
            $del = function (string $table, string $where = '1=1', array $args = []) {
                ERP_DB::query('DELETE FROM ' . ERP_DB::t($table) . ' WHERE ' . $where, $args);
            };
            $del('payment');
            $del('retention_release');
            $del('certificate');
            $del('contract');
            self::delete_self_ref('invoice', 'origin_id');
            $del('transfer');
            $del('stock_document');
            $del('stock_move');
            $del('depreciation_run');
            $del('asset');
            $del('asset_category');
            $del('journal_entry');
            $del('product');
            $del('warehouse', 'code <> %s', ['WH1']);
            ERP_DB::query('UPDATE ' . ERP_DB::t('warehouse') . ' SET project_id = NULL');
            $del('project');
            $del('partner');
            self::delete_self_ref('cost_center', 'parent_id');
            $del('sequence');
            ERP_Audit::log('reset', '', null, null, null, 'مسح كل الحركات والبيانات مع الإبقاء على الإعدادات');
        });
    }

    /** حذف جدول به مرجع ذاتي (RESTRICT) بالترتيب من الأوراق للجذر. */
    private static function delete_self_ref(string $table, string $col): void
    {
        $t = ERP_DB::t($table);
        for ($i = 0; $i < 100; $i++) {
            $leaves = ERP_DB::col("SELECT id FROM {$t} WHERE id NOT IN "
                . "(SELECT {$col} FROM {$t} WHERE {$col} IS NOT NULL) LIMIT 5000");
            if (!$leaves) {
                return;
            }
            $ph = implode(',', array_fill(0, count($leaves), '%d'));
            ERP_DB::query("DELETE FROM {$t} WHERE id IN ({$ph})", array_map('intval', $leaves));
        }
    }

    /** هل قاعدة البيانات فارغة تماماً من أي بيانات محاسبية؟ (شرط الاسترجاع) */
    public static function is_empty(): bool
    {
        foreach (ERP_Schema::data_tables() as $t) {
            if ($t === 'company') {
                continue;
            }
            if ((int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t($t))) {
                return false;
            }
        }
        return true;
    }
}
