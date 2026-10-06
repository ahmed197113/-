<?php
/** الصلاحيات و nonce والهروب والسجل غير القابل للحذف. */
class Test_Security extends ERP_TestCase
{
    protected function set_up(): void
    {
        parent::set_up();
        $this->setup_company();
        $_POST = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
    }

    protected function tear_down(): void
    {
        $_POST = [];
        $_GET = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
        parent::tear_down();
    }

    private function user(string $role): int
    {
        $login = 'u_' . $role . wp_rand();
        return wp_insert_user(['user_login' => $login, 'user_pass' => 'Strong-Pass-123', 'role' => $role]);
    }

    public function test_user_without_erp_role_is_blocked_everywhere(): void
    {
        wp_set_current_user($this->user('subscriber'));
        foreach (['/', '/journal/', '/accounts/', '/reports/trial-balance/', '/settings/', '/settings/backup/'] as $p) {
            $this->assertSame(403, ERP_Router::handle($p, false)['status'], $p);
        }
    }

    public function test_viewer_can_read_but_not_write(): void
    {
        wp_set_current_user($this->user('erp_viewer'));
        $this->assertSame(200, ERP_Router::handle('/reports/trial-balance/', false)['status']);
        $this->assertSame(200, ERP_Router::handle('/journal/', false)['status']);
        $this->assertSame(403, ERP_Router::handle('/journal/new/', false)['status']);
        $this->assertSame(403, ERP_Router::handle('/settings/system/', false)['status']);
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['_erp_nonce' => wp_create_nonce('erp'), 'code' => '9999', 'name' => 'x', 'type' => 'asset', 'kind' => 'other'];
        $this->assertSame(403, ERP_Router::handle('/accounts/new/', true)['status']);
        $this->assertNull(ERP_Accounts::by_code('9999'));
    }

    public function test_post_without_valid_nonce_is_rejected(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['code' => '9999', 'name' => 'x', 'type' => 'asset', 'kind' => 'other', 'active' => '1'];
        $this->assertSame(403, ERP_Router::handle('/accounts/new/', true)['status']);
        $_POST['_erp_nonce'] = 'bad';
        $this->assertSame(403, ERP_Router::handle('/accounts/new/', true)['status']);
        $this->assertNull(ERP_Accounts::by_code('9999'));
        $_POST['_erp_nonce'] = wp_create_nonce('erp');
        $r = ERP_Router::handle('/accounts/new/', true);
        $this->assertArrayHasKey('redirect', $r);
        $this->assertNotNull(ERP_Accounts::by_code('9999'));
    }

    public function test_server_side_validation(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['_erp_nonce' => wp_create_nonce('erp'), 'code' => '9998', 'name' => 'x', 'type' => 'hacker', 'kind' => 'other',
            'parent' => (string) $this->acc('1211')['id']];
        $r = ERP_Router::handle('/accounts/new/', true);
        $this->assertSame(200, $r['status']);
        $this->assertStringContainsString('اختر قيمة صحيحة', $r['body']);
        $this->assertStringContainsString('اختر قيمة صحيحة. الاختيار غير متاح.', $r['body']); // أب غير تجميعي
        $this->assertNull(ERP_Accounts::by_code('9998'));
    }

    public function test_output_is_escaped(): void
    {
        ERP_DB::insert('partner', ['name' => '<script>alert(1)</script>', 'type' => 'customer']);
        $body = ERP_Router::handle('/partners/', false)['body'];
        $this->assertStringNotContainsString('<script>alert(1)</script>', $body);
        $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $body);
    }

    public function test_sql_injection_in_filters_is_neutral(): void
    {
        $_GET = ['q' => "x' OR 1=1 --", 'state' => "posted' OR '1'='1", 'source' => 'manual'];
        $r = ERP_Router::handle('/journal/', false);
        $this->assertSame(200, $r['status']);
        $this->assertSame(0, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('error_log')));
    }

    public function test_audit_log_is_append_only(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['_erp_nonce' => wp_create_nonce('erp'), 'code' => '9997', 'name' => 'تدقيق', 'type' => 'asset', 'kind' => 'other', 'active' => '1'];
        ERP_Router::handle('/accounts/new/', true);
        $row = ERP_DB::row('SELECT * FROM ' . ERP_DB::t('audit_log') . " WHERE table_name='account' AND action='create'");
        $this->assertNotNull($row);
        $this->assertSame('erpadmin', $row['user_login']);
        $this->assertStringContainsString('9997', $row['after_data']);
        // المسار الوحيد للسجل هو عرضه، ولا يقبل أي تعديل: POST عليه لا يغيّر عدد السجلات
        $audit_routes = array_filter(ERP_Router::routes(), function ($r) {
            return strpos($r[0], 'audit') !== false;
        });
        $this->assertSame(['ERP_Views::audit_log'], array_values(array_column($audit_routes, 1)));
        $count = (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('audit_log'));
        $_POST = ['_erp_nonce' => wp_create_nonce('erp'), 'op' => 'delete'];
        ERP_Router::handle('/settings/audit/', true);
        $this->assertSame($count, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('audit_log')));
        $_POST = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $this->assertSame(['log'], array_values(array_filter(get_class_methods('ERP_Audit'), function ($m) {
            return $m !== '__construct';
        })));
        $this->assertSame(200, ERP_Router::handle('/settings/audit/', false)['status']);
    }

    public function test_internal_errors_are_logged_not_shown(): void
    {
        add_filter('erp_test_boom', '__return_true');
        $r = ERP_Router::handle('/journal/abc/', false);
        $this->assertSame(404, $r['status']);
        $this->assertStringNotContainsString('Fatal', $r['body']);
    }
}
