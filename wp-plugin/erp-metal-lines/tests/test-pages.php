<?php
/** كل صفحات المرحلة الأولى تفتح بدون أخطاء بعد استيراد البيانات المرجعية (مثل DemoAndPagesTests في الأصل). */
class Test_Pages extends ERP_TestCase
{
    public function test_all_phase1_pages_render(): void
    {
        ERP_Backup::restore(file_get_contents(__DIR__ . '/fixtures/golden/backup.json'));
        $acc = (int) ERP_Accounts::by_code('1213')['id'];
        $entry = (int) ERP_DB::value('SELECT id FROM ' . ERP_DB::t('journal_entry') . " WHERE source='manual' ORDER BY id LIMIT 1");
        $tpl = (int) ERP_DB::value('SELECT id FROM ' . ERP_DB::t('journal_template') . ' ORDER BY id LIMIT 1');
        $pages = ['/', '/accounts/', '/accounts/new/', "/accounts/{$acc}/", '/cost-centers/', '/cost-centers/new/', '/taxes/', '/taxes/1/',
            '/partners/', '/partners/new/', '/partners/1/', '/partners/1/edit/', '/journal/', '/journal/new/', "/journal/{$entry}/",
            '/journal/templates/', '/journal/templates/new/', "/journal/templates/{$tpl}/use/", "/journal/templates/{$tpl}/edit/",
            '/settings/', '/settings/mapping/', '/settings/close-year/', '/settings/system/', '/settings/audit/', '/reports/',
            '/reports/trial-balance/', '/reports/ledger/', "/reports/ledger/", '/reports/partner-statement/', '/reports/partner-statement/1/'];
        $_GET = ['account' => (string) $acc];
        foreach ($pages as $p) {
            $r = ERP_Router::handle($p, false);
            $this->assertSame(200, $r['status'] ?? 0, $p . ' ' . substr(wp_strip_all_tags($r['body'] ?? ''), 0, 200));
        }
        $_GET = [];
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('error_log')));
        $this->assertSame(404, ERP_Router::handle('/nope/', false)['status']);
        $dl = ERP_Router::handle('/settings/backup/', false);
        $this->assertArrayHasKey('download', $dl);
        $this->assertSame(ERP_Backup::FORMAT, json_decode($dl['download']['body'], true)['format']);
    }

    public function test_manual_entry_through_ui(): void
    {
        $this->setup_company();
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['_erp_nonce' => wp_create_nonce('erp'), 'date' => '2026-05-01', 'source' => 'manual', 'reference' => '', 'memo' => 'إيداع',
            'lines-TOTAL_FORMS' => '3',
            'lines-0-account' => (string) $this->acc('1213')['id'], 'lines-0-label' => '', 'lines-0-debit' => '1,500.50', 'lines-0-credit' => '0',
            'lines-1-account' => (string) $this->acc('1211')['id'], 'lines-1-label' => '', 'lines-1-debit' => '0', 'lines-1-credit' => '1500.50',
            'lines-2-account' => '', 'lines-2-debit' => '0', 'lines-2-credit' => '0'];
        $r = ERP_Router::handle('/journal/new/', true);
        $this->assertArrayHasKey('redirect', $r, wp_strip_all_tags($r['body'] ?? ''));
        $id = (int) ERP_DB::value('SELECT id FROM ' . ERP_DB::t('journal_entry'));
        $_POST = ['_erp_nonce' => wp_create_nonce('erp')];
        ERP_Router::handle("/journal/{$id}/post/", true);
        $this->assertMoney('1500.50', $this->balance('1213'));
        // غير متزن عبر الواجهة ⇒ لا حفظ ورسالة الأصل
        $_POST = ['_erp_nonce' => wp_create_nonce('erp'), 'date' => '2026-05-01', 'source' => 'manual', 'memo' => 'x', 'lines-TOTAL_FORMS' => '2',
            'lines-0-account' => (string) $this->acc('1213')['id'], 'lines-0-debit' => '10', 'lines-0-credit' => '0',
            'lines-1-account' => (string) $this->acc('1211')['id'], 'lines-1-debit' => '0', 'lines-1-credit' => '9'];
        $r = ERP_Router::handle('/journal/new/', true);
        $this->assertStringContainsString('القيد غير متزن: مدين 10.00 - دائن 9.00 = فرق 1.00', $r['body']);
        $this->assertSame(1, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_entry')));
        $_POST = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
    }
}
