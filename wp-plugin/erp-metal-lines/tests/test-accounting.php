<?php
/**
 * المرحلة الأولى: نقل PostingTests من accounting/tests.py + اختبارات سلبية وإضافية للنواة المحاسبية.
 */
class Test_Accounting extends ERP_TestCase
{
    private $today;

    protected function set_up(): void
    {
        parent::set_up();
        $this->setup_company();
        $this->today = ERP_UI::today();
    }

    private function line(string $code, $d, $c, array $extra = []): array
    {
        return ['account' => $this->acc($code), 'debit' => $d, 'credit' => $c] + $extra;
    }

    // ---------------------------------------------------------------- PostingTests (الأصل)
    public function test_unbalanced_entry_rejected(): void
    {
        $this->expectException(ERP_Validation_Error::class);
        $this->expectExceptionMessage('القيد غير متزن: إجمالي المدين 100.00 ≠ إجمالي الدائن 90.00');
        ERP_Posting::create_entry($this->today, 'x', [$this->line('1211', '100', '0'), $this->line('3101', '0', '90')]);
    }

    public function test_group_account_rejected(): void
    {
        $this->expectException(ERP_Validation_Error::class);
        $this->expectExceptionMessage('الحساب 121 - النقدية وما في حكمها حساب تجميعي ولا يقبل قيوداً');
        ERP_Posting::create_entry($this->today, 'x', [$this->line('121', '100', '0'), $this->line('3101', '0', '100')]);
    }

    public function test_lock_date(): void
    {
        $c = ERP_Company::get();
        ERP_DB::update('company', (int) $c['id'], ['lock_date' => $this->today]);
        try {
            ERP_Posting::create_entry($this->today, 'x', [$this->line('1211', '100', '0'), $this->line('3101', '0', '100')]);
            $this->fail('expected lock error');
        } catch (ERP_Validation_Error $e) {
            $d = str_replace('-', '/', $this->today);
            $this->assertSame("الفترة مقفلة حتى {$d}. لا يمكن تسجيل أو تعديل حركات بتاريخ {$d}", $e->getMessage());
        }
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_entry')));
    }

    // ---------------------------------------------------------------- سلبية إضافية
    public function test_single_line_and_both_sides_rejected(): void
    {
        try {
            ERP_Posting::create_entry($this->today, 'x', [$this->line('1211', '100', '0')]);
            $this->fail();
        } catch (ERP_Validation_Error $e) {
            $this->assertSame('القيد يجب أن يحتوي على سطرين على الأقل', $e->getMessage());
        }
        try {
            ERP_Posting::create_entry($this->today, 'x', [$this->line('1211', '100', '100'), $this->line('3101', '0', '0'),
                $this->line('1213', '50', '0'), $this->line('3101', '0', '50')]);
            $this->fail();
        } catch (ERP_Validation_Error $e) {
            $this->assertSame('لا يجوز أن يحتوي السطر الواحد على مدين ودائن معاً', $e->getMessage());
        }
    }

    public function test_inactive_account_rejected(): void
    {
        ERP_DB::update('account', (int) $this->acc('1214')['id'], ['active' => 0]);
        ERP_Accounts::flush();
        $this->expectException(ERP_Validation_Error::class);
        $this->expectExceptionMessage('غير نشط');
        ERP_Posting::create_entry($this->today, 'x', [$this->line('1214', '100', '0'), $this->line('3101', '0', '100')]);
    }

    public function test_cannot_delete_account_or_partner_with_movements(): void
    {
        $p = ERP_DB::insert('partner', ['name' => 'عميل', 'type' => 'customer']);
        ERP_Posting::create_entry($this->today, 'x', [$this->line('1221', '100', '0', ['partner' => ['id' => $p]]),
            $this->line('4102', '0', '100')]);
        foreach ([['account', (int) $this->acc('1221')['id']], ['partner', $p], ['account', (int) $this->acc('12')['id']]] as [$t, $id]) {
            try {
                ERP_DB::delete($t, $id);
                $this->fail("{$t} {$id} deleted");
            } catch (ERP_Validation_Error $e) {
                $this->assertStringContainsString('مرتبطة', $e->getMessage());
            }
        }
        $this->assertNotNull(ERP_DB::get('partner', $p));
    }

    public function test_unique_codes_enforced_by_database(): void
    {
        $this->expectException(ERP_Validation_Error::class);
        ERP_DB::insert('account', ['code' => '1211', 'name' => 'مكرر', 'type' => 'asset']);
    }

    // ---------------------------------------------------------------- المعاملات
    public function test_failed_entry_rolls_back_completely(): void
    {
        $before = ERP_DB::value('SELECT next_number FROM ' . ERP_DB::t('sequence') . " WHERE seq_key='JE'");
        try {
            ERP_Posting::create_entry($this->today, 'x', [
                $this->line('1211', '100', '0'),
                ['account' => ['id' => 999999, 'code' => 'X', 'name' => 'X', 'is_group' => 0, 'active' => 1], 'debit' => '0', 'credit' => '100'],
            ]);
            $this->fail('expected FK failure');
        } catch (ERP_Validation_Error $e) {
            $this->assertStringContainsString('مرتبطة', $e->getMessage());
        }
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_entry')));
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_line')));
        $this->assertSame($before, ERP_DB::value('SELECT next_number FROM ' . ERP_DB::t('sequence') . " WHERE seq_key='JE'"));
        $this->assertFalse(ERP_DB::in_transaction());
    }

    // ---------------------------------------------------------------- EntryBuilder
    public function test_entry_builder_merges_and_flips_negatives(): void
    {
        $b = new ERP_EntryBuilder($this->today, 'دمج');
        $b->debit($this->acc('5101'), '10.005', ['label' => 'x']);   // r2 HALF_EVEN ⇒ 10.00
        $b->debit($this->acc('5101'), '5.015', ['label' => 'x']);    // ⇒ 5.02 ، مدمج ⇒ 15.02
        $b->credit($this->acc('1211'), '-3', ['label' => 'y']);      // دائن سالب ⇒ مدين 3
        $b->credit($this->acc('1213'), '18.02');
        $lines = $b->lines();
        $this->assertCount(3, $lines);
        $this->assertMoney('15.02', $lines[0]['debit']);
        $this->assertMoney('3', $lines[1]['debit']);
        $id = $b->post();
        [$d, $c] = ERP_Journal::totals($id);
        $this->assertMoney('18.02', $d);
        $this->assertMoney($d, $c);
    }

    // ---------------------------------------------------------------- القيود اليدوية والجاهزة
    public function test_manual_entry_lifecycle(): void
    {
        $id = ERP_Journal::save_manual(null, ['date' => $this->today, 'source' => 'opening', 'reference' => 'R', 'memo' => 'افتتاحي'], [
            ['account_id' => (int) $this->acc('1213')['id'], 'label' => '', 'debit' => '1000', 'credit' => '0'],
            ['account_id' => (int) $this->acc('3501')['id'], 'label' => '', 'debit' => '0', 'credit' => '1000'],
        ]);
        $e = ERP_DB::get('journal_entry', $id);
        $this->assertSame('draft', $e['state']);
        $this->assertSame('JV-00001', $e['number']);
        $this->assertMoney('0', $this->balance('1213'));
        ERP_Posting::post_manual($id);
        $this->assertMoney('1000', $this->balance('1213'));
        $this->assertLedgerBalanced();
        $this->assertGreaterThanOrEqual(2, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('audit_log')
            . " WHERE table_name='journal_entry' AND record_id=%d", [$id]));
    }

    public function test_template_amounts_use_half_even_percentages(): void
    {
        $t = ERP_DB::insert('journal_template', ['name' => 'نسبة', 'memo' => 'm']);
        ERP_DB::insert('journal_template_line', ['template_id' => $t, 'account_id' => (int) $this->acc('5103')['id'], 'side' => 'debit', 'percent' => '100']);
        ERP_DB::insert('journal_template_line', ['template_id' => $t, 'account_id' => (int) $this->acc('2224')['id'], 'side' => 'credit', 'percent' => '2.5']);
        ERP_DB::insert('journal_template_line', ['template_id' => $t, 'account_id' => (int) $this->acc('1211')['id'], 'side' => 'credit', 'percent' => '97.5']);
        // 100.10 × 2.5% = 2.5025 ⇒ 2.50 ، 100.10 × 97.5% = 97.5975 ⇒ 97.60 ⇒ متزن
        $this->assertSame('2.50', ERP_Money::pct_amount('100.10', '2.5'));
        $this->assertSame('97.60', ERP_Money::pct_amount('100.10', '97.5'));
        // حالة تعادل: 0.125 ⇒ 0.12 (HALF_EVEN) وليس 0.13
        $this->assertSame('0.12', ERP_Money::pct_amount('12.5', '1'));
    }

    public function test_year_close_moves_pl_to_retained_earnings_and_locks(): void
    {
        $y = (int) substr($this->today, 0, 4) - 1;
        ERP_Posting::create_entry("{$y}-03-01", 'إيراد', [$this->line('1211', '5000', '0'), $this->line('4201', '0', '5000')]);
        ERP_Posting::create_entry("{$y}-04-01", 'مصروف', [$this->line('5202', '1200', '0'), $this->line('1211', '0', '1200')]);
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['date_from' => "{$y}-01-01", 'date_to' => "{$y}-12-31", 'lock' => '1', '_erp_nonce' => wp_create_nonce('erp')];
        $r = ERP_Router::handle('/settings/close-year/', true);
        $_POST = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $this->assertArrayHasKey('redirect', $r);
        $this->assertMoney('0', $this->balance('4201'));
        $this->assertMoney('0', $this->balance('5202'));
        $this->assertMoney('-3800', $this->balance('3301'));
        $this->assertSame("{$y}-12-31", ERP_Company::get()['lock_date']);
        $this->expectException(ERP_Validation_Error::class);
        ERP_Posting::create_entry("{$y}-12-31", 'x', [$this->line('1211', '1', '0'), $this->line('4201', '0', '1')]);
    }

    public function test_partner_accounts_follow_mapping_rules(): void
    {
        $sub = ERP_DB::get('partner', ERP_DB::insert('partner', ['name' => 'مقاول', 'type' => 'subcontractor']));
        $sup = ERP_DB::get('partner', ERP_DB::insert('partner', ['name' => 'مورد', 'type' => 'supplier']));
        $cus = ERP_DB::get('partner', ERP_DB::insert('partner', ['name' => 'عميل', 'type' => 'both']));
        $this->assertSame('2212', ERP_Partners::main_account($sub)['code']);
        $this->assertSame('2211', ERP_Partners::main_account($sup)['code']);
        $this->assertSame('1221', ERP_Partners::main_account($cus)['code']);
        ERP_DB::query('DELETE FROM ' . ERP_DB::t('account_mapping') . " WHERE role='payable'");
        $this->expectExceptionMessage('لم يتم تحديد حساب لـ «حساب الموردين الافتراضي» في إعدادات التوجيه المحاسبي');
        ERP_Partners::ap_account($sup);
    }

    public function test_setup_is_idempotent_and_reset_keeps_setup(): void
    {
        ERP_Seed::setup_company();
        $this->assertSame(113, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('account')));
        $p = ERP_DB::insert('partner', ['name' => 'عميل', 'type' => 'customer']);
        ERP_Posting::create_entry($this->today, 'x', [$this->line('1221', '10', '0', ['partner' => ['id' => $p]]), $this->line('4102', '0', '10')]);
        ERP_Seed::reset_data();
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_entry')));
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('partner')));
        $this->assertSame(113, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('account')));
        $this->assertSame(26, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('account_mapping')));
        $this->assertGreaterThan(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('audit_log') . " WHERE action='reset'"));
    }
}
