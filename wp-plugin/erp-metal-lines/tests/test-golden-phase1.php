<?php
/**
 * اختبار المطابقة الشامل للمرحلة الأولى:
 * يستورد نسخة Django الاحتياطية (المجموعة المرجعية) ثم يطابق ميزان المراجعة ودفتر الأستاذ
 * مع مخرجات البرنامج الأصلي رقماً برقم (فرق صفر).
 */
class Test_Golden_Phase1 extends ERP_TestCase
{
    private static $golden;

    public static function set_up_before_class(): void
    {
        parent::set_up_before_class();
        self::$golden = json_decode(file_get_contents(__DIR__ . '/fixtures/golden/reports.json'), true);
    }

    protected function set_up(): void
    {
        parent::set_up();
        ERP_Backup::restore(file_get_contents(__DIR__ . '/fixtures/golden/backup.json'));
    }

    private static function f2($v): string
    {
        return ERP_Money::fixed($v, 2);
    }

    public function test_import_counts_match_django(): void
    {
        $items = json_decode(file_get_contents(__DIR__ . '/fixtures/golden/backup.json'), true);
        $expected = [];
        foreach ($items as $it) {
            $expected[$it['model']] = ($expected[$it['model']] ?? 0) + 1;
        }
        foreach (ERP_DB::schema()['tables'] as $name => $def) {
            $label = strtolower($def['app'] . '.' . $def['model']);
            $this->assertSame($expected[$label] ?? 0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t($name)), $name);
        }
    }

    public function test_trial_balances_match_reference(): void
    {
        $diffs = 0;
        foreach (self::$golden['trial_balance'] as $case) {
            $p = $case['params'];
            $filters = isset($p['project']) ? ['project_id' => (int) $p['project']] : [];
            $tb = ERP_Reports::trial_balance($p['date_from'], $p['date_to'], $p['level'], isset($p['zero']), $filters);
            $got = [
                'balanced' => $tb['balanced'],
                'totals' => array_map([self::class, 'f2'], $tb['totals']),
                'rows' => array_map(function ($r) {
                    return ['code' => $r['account']['code'], 'level' => $r['level'], 'is_group' => $r['is_group'],
                        'vals' => array_map([self::class, 'f2'], $r['vals'])];
                }, $tb['rows']),
            ];
            $exp = ['balanced' => $case['balanced'], 'totals' => $case['totals'], 'rows' => $case['rows']];
            if ($got !== $exp) {
                $diffs++;
            }
            $this->assertSame($exp, $got, 'TB ' . wp_json_encode($p));
        }
        $this->assertSame(0, $diffs);
        $this->assertCount(64, self::$golden['trial_balance']);
    }

    public function test_ledgers_match_reference(): void
    {
        foreach (self::$golden['ledger'] as $case) {
            $p = $case['params'];
            $filters = isset($p['project']) ? ['project_id' => (int) $p['project']] : [];
            $l = ERP_Reports::ledger((int) $p['account'], $p['date_from'], $p['date_to'], $filters);
            $got = [
                'account_code' => $l['account']['code'], 'opening' => self::f2($l['opening']), 'closing' => self::f2($l['closing']),
                'total_debit' => self::f2($l['total_debit']), 'total_credit' => self::f2($l['total_credit']),
                'rows' => array_map(function ($r) {
                    return ['entry' => $r['line']['entry_number'], 'date' => $r['line']['entry_date'],
                        'debit' => self::f2($r['line']['debit']), 'credit' => self::f2($r['line']['credit']),
                        'balance' => self::f2($r['balance'])];
                }, $l['rows']),
            ];
            $exp = $case;
            unset($exp['params']);
            $this->assertSame($exp, $got, 'Ledger ' . wp_json_encode($p));
        }
        foreach (self::$golden['partner_ledger'] as $case) {
            $p = $case['params'];
            $l = ERP_Reports::ledger((int) $p['account'], $p['date_from'], $p['date_to'], ['partner_id' => (int) $p['partner']]);
            $this->assertSame($case['opening'], self::f2($l['opening']));
            $this->assertSame($case['closing'], self::f2($l['closing']));
            $this->assertSame($case['rows'], array_map(function ($r) {
                return ['entry' => $r['line']['entry_number'], 'balance' => self::f2($r['balance'])];
            }, $l['rows']), 'Partner ledger ' . wp_json_encode($p));
        }
    }

    public function test_backup_roundtrip_is_lossless(): void
    {
        $dump1 = ERP_Backup::export();
        self::truncate_all();
        ERP_Backup::restore(wp_json_encode($dump1));
        $dump2 = ERP_Backup::export();
        $this->assertSame($dump1['tables'], $dump2['tables']);
    }
}
