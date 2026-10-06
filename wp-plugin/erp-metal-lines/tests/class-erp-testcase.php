<?php
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/** قاعدة الاختبارات: جداول حقيقية (InnoDB + مفاتيح أجنبية + معاملات حقيقية) تُفرّغ قبل كل اختبار. */
abstract class ERP_TestCase extends TestCase
{
    protected static $admin_id;

    public static function set_up_before_class(): void
    {
        parent::set_up_before_class();
        if (!self::$admin_id) {
            $u = get_user_by('login', 'erpadmin');
            self::$admin_id = $u ? $u->ID : wp_insert_user(['user_login' => 'erpadmin', 'user_pass' => 'x-Strong-Pass-1',
                'role' => 'administrator']);
        }
    }

    protected function set_up(): void
    {
        parent::set_up();
        self::truncate_all();
        wp_set_current_user(self::$admin_id);
    }

    public static function truncate_all(): void
    {
        global $wpdb;
        $wpdb->query('SET FOREIGN_KEY_CHECKS = 0');
        foreach (array_keys(ERP_Schema::all_tables()) as $t) {
            $wpdb->query('TRUNCATE TABLE ' . ERP_DB::t($t));
        }
        $wpdb->query('SET FOREIGN_KEY_CHECKS = 1');
        ERP_Accounts::flush();
    }

    protected function acc(string $code): array
    {
        return ERP_Accounts::by_code($code);
    }

    /** رصيد حساب (مدين - دائن) للقيود المرحّلة بشروط إضافية اختيارية — مثل balance() في اختبارات الأصل. */
    protected function balance(string $code, array $where = []): string
    {
        $sql = 'SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM ' . ERP_DB::t('journal_line') . ' l JOIN '
            . ERP_DB::t('journal_entry') . ' e ON e.id=l.entry_id JOIN ' . ERP_DB::t('account')
            . " a ON a.id=l.account_id WHERE e.state='posted' AND a.code=%s";
        $args = [$code];
        foreach ($where as $col => $v) {
            $sql .= " AND l.{$col} = %d";
            $args[] = $v;
        }
        $r = ERP_DB::row($sql, $args);
        return ERP_Money::sub($r['d'], $r['c']);
    }

    protected function assertMoney($expected, $actual, string $msg = ''): void
    {
        $this->assertSame(0, ERP_Money::cmp($expected, $actual), $msg . " expected {$expected} got {$actual}");
    }

    protected function assertLedgerBalanced(): void
    {
        [$d, $c] = ERP_Reports::totals(null, null);
        $this->assertMoney($d, $c, 'ledger balanced');
    }

    protected function setup_company(): void
    {
        ERP_Seed::setup_company();
    }
}
