<?php
/**
 * الموجّه: الإضافة تتولى الواجهة الأمامية كاملة لتثبيت WordPress المخصص (erp.metal-lines.com)
 * بنفس مسارات البرنامج الأصلي (/journal/ و /reports/trial-balance/ …).
 * - غير المسجّل ⇒ صفحة دخول WordPress. لا توجد أي صفحة عامة.
 * - كل مسار له صلاحية، وكل POST يتطلب nonce صالحاً.
 * - أي خطأ غير متوقع يُسجّل داخلياً ويظهر للمستخدم برسالة عربية فقط.
 */
defined('ABSPATH') || exit;

final class ERP_Router
{
    /** [regex, handler, cap للعرض (GET), cap للتعديل (POST)] */
    public static function routes(): array
    {
        $V = 'ERP_Views::';
        return [
            ['#^/$#', $V . 'dashboard', 'erp_access', 'erp_access'],
            ['#^/accounts/$#', $V . 'account_tree', 'erp_access', 'erp_manage_accounts'],
            ['#^/accounts/new/$#', $V . 'account_form', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/accounts/(\d+)/$#', $V . 'account_form', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/accounts/(\d+)/delete/$#', $V . 'account_delete', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/cost-centers/$#', $V . 'cost_center_list', 'erp_access', 'erp_manage_accounts'],
            ['#^/cost-centers/new/$#', $V . 'cost_center_form', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/cost-centers/(\d+)/$#', $V . 'cost_center_form', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/taxes/$#', $V . 'tax_list', 'erp_access', 'erp_manage_accounts'],
            ['#^/taxes/new/$#', $V . 'tax_form', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/taxes/(\d+)/$#', $V . 'tax_form', 'erp_manage_accounts', 'erp_manage_accounts'],
            ['#^/partners/$#', $V . 'partner_list', 'erp_access', 'erp_manage_partners'],
            ['#^/partners/new/$#', $V . 'partner_form', 'erp_manage_partners', 'erp_manage_partners'],
            ['#^/partners/(\d+)/$#', $V . 'partner_detail', 'erp_access', 'erp_manage_partners'],
            ['#^/partners/(\d+)/edit/$#', $V . 'partner_form', 'erp_manage_partners', 'erp_manage_partners'],
            ['#^/journal/$#', $V . 'journal_list', 'erp_access', 'erp_edit_entries'],
            ['#^/journal/new/$#', $V . 'journal_form', 'erp_edit_entries', 'erp_edit_entries'],
            ['#^/journal/templates/$#', $V . 'template_list', 'erp_access', 'erp_edit_entries'],
            ['#^/journal/templates/new/$#', $V . 'template_form', 'erp_manage_settings', 'erp_manage_settings'],
            ['#^/journal/templates/(\d+)/edit/$#', $V . 'template_form', 'erp_manage_settings', 'erp_manage_settings'],
            ['#^/journal/templates/(\d+)/use/$#', $V . 'template_use', 'erp_edit_entries', 'erp_edit_entries'],
            ['#^/journal/(\d+)/$#', $V . 'journal_detail', 'erp_access', 'erp_post_entries'],
            ['#^/journal/(\d+)/edit/$#', $V . 'journal_form', 'erp_edit_entries', 'erp_edit_entries'],
            ['#^/journal/(\d+)/(post|unpost|delete|reverse)/$#', $V . 'journal_action', 'erp_post_entries', 'erp_post_entries'],
            ['#^/settings/$#', $V . 'settings', 'erp_manage_settings', 'erp_manage_settings'],
            ['#^/settings/mapping/$#', $V . 'mapping', 'erp_manage_settings', 'erp_manage_settings'],
            ['#^/settings/close-year/$#', $V . 'year_close', 'erp_manage_settings', 'erp_manage_settings'],
            ['#^/settings/backup/$#', $V . 'backup', 'erp_admin', 'erp_admin'],
            ['#^/settings/system/$#', $V . 'system', 'erp_admin', 'erp_admin'],
            ['#^/settings/audit/$#', $V . 'audit_log', 'erp_admin', 'erp_admin'],
            ['#^/reports/$#', $V . 'reports_index', 'erp_view_reports', 'erp_view_reports'],
            ['#^/reports/trial-balance/$#', $V . 'trial_balance', 'erp_view_reports', 'erp_view_reports'],
            ['#^/reports/ledger/$#', $V . 'ledger', 'erp_view_reports', 'erp_view_reports'],
            ['#^/reports/partner-statement/$#', $V . 'partner_statement', 'erp_view_reports', 'erp_view_reports'],
            ['#^/reports/partner-statement/(\d+)/$#', $V . 'partner_statement', 'erp_view_reports', 'erp_view_reports'],
        ];
    }

    public static function init(): void
    {
        add_action('template_redirect', [self::class, 'dispatch'], 0);
        // تقوية الأمان لتثبيت مخصص: لا REST لغير المسجّلين، لا XML-RPC، لا تسجيل عام، لا شريط إدارة
        add_filter('rest_authentication_errors', function ($result) {
            if (!empty($result) || is_user_logged_in()) {
                return $result;
            }
            return new WP_Error('rest_forbidden', 'غير مسموح', ['status' => 401]);
        });
        add_filter('xmlrpc_enabled', '__return_false');
        add_filter('xmlrpc_methods', '__return_empty_array');
        add_action('init', function () {
            if (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST) {
                status_header(403);
                exit;
            }
        }, 0);
        add_filter('pre_option_users_can_register', '__return_zero');
        add_filter('show_admin_bar', '__return_false');
        add_filter('login_redirect', function ($to, $requested, $user) {
            return ($user instanceof WP_User && $user->has_cap('erp_access')) ? home_url('/') : $to;
        }, 10, 3);
    }

    /** المسار النسبي للطلب الحالي (بعد مسار الموقع). */
    public static function path(): string
    {
        $uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
        $path = (string) wp_parse_url($uri, PHP_URL_PATH);
        $base = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
        if ($base !== '/' && strpos($path, rtrim($base, '/')) === 0) {
            $path = substr($path, strlen(rtrim($base, '/')));
        }
        $path = '/' . ltrim($path, '/');
        return substr($path, -1) === '/' ? $path : $path . '/';
    }

    public static function dispatch(): void
    {
        if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }
        if (!is_user_logged_in()) {
            auth_redirect();
            exit;
        }
        $is_post = isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST';
        $r = self::handle(self::path(), $is_post);
        nocache_headers();
        header('X-Frame-Options: SAMEORIGIN');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        if (isset($r['redirect'])) {
            wp_safe_redirect($r['redirect']);
            exit;
        }
        if (isset($r['download'])) {
            header('Content-Type: ' . $r['download']['type']);
            header('Content-Disposition: attachment; filename="' . $r['download']['name'] . '"');
            echo $r['download']['body']; // phpcs:ignore
            exit;
        }
        status_header($r['status']);
        header('Content-Type: text/html; charset=utf-8');
        echo $r['body']; // phpcs:ignore — القوالب تهرب كل القيم بنفسها
        exit;
    }

    /**
     * يعالج الطلب ويرجع الاستجابة كمصفوفة (قابل للاختبار بدون exit):
     * ['status'=>, 'body'=>] أو ['redirect'=>] أو ['download'=>].
     */
    public static function handle(string $path, bool $is_post): array
    {
        try {
            if (!current_user_can('erp_access')) {
                self::error_page(403, 'ليس لديك صلاحية الدخول لهذا البرنامج. تواصل مع مدير النظام.');
            }
            foreach (self::routes() as [$re, $handler, $view_cap, $edit_cap]) {
                if (!preg_match($re, $path, $m)) {
                    continue;
                }
                if (!current_user_can($is_post ? $edit_cap : $view_cap)) {
                    self::error_page(403, 'ليس لديك صلاحية لهذه الصفحة أو العملية.');
                }
                if ($is_post) {
                    $nonce = isset($_POST['_erp_nonce']) ? sanitize_text_field(wp_unslash($_POST['_erp_nonce'])) : '';
                    if (!wp_verify_nonce($nonce, ERP_UI::NONCE)) {
                        self::error_page(403, 'انتهت صلاحية الصفحة أو الطلب غير موثوق. أعد تحميل الصفحة وحاول مرة أخرى.');
                    }
                }
                array_shift($m);
                try {
                    $out = call_user_func_array($handler, $m);
                } catch (ERP_Validation_Error $e) {
                    ERP_UI::flash('danger', $e->getMessage());
                    self::back();
                }
                if (is_array($out)) {
                    return $out;
                }
                return ['status' => 200, 'body' => (string) $out];
            }
            self::error_page(404, 'الصفحة غير موجودة.');
        } catch (ERP_Http_Response $r) {
            return $r->response;
        } catch (Throwable $e) {
            ERP_Log::error(get_class($e) . ': ' . $e->getMessage(), ['path' => $path, 'trace' => $e->getTraceAsString()]);
            return ['status' => 500, 'body' => ERP_Templates::page('error', ['title' => 'تنبيه', 'status' => 500,
                'message' => 'حدث خطأ غير متوقع ولم يتم حفظ أي تغيير. تم تسجيل الخطأ لمراجعته من مدير النظام.'])];
        }
        return ['status' => 500, 'body' => ''];
    }

    public static function redirect(string $path): void
    {
        throw new ERP_Http_Response(['redirect' => strpos($path, 'http') === 0 ? $path : home_url($path)]);
    }

    public static function back(): void
    {
        $ref = wp_get_referer();
        throw new ERP_Http_Response(['redirect' => $ref ?: home_url('/')]);
    }

    public static function error_page(int $status, string $message): void
    {
        throw new ERP_Http_Response(['status' => $status,
            'body' => ERP_Templates::page('error', ['title' => 'تنبيه', 'status' => $status, 'message' => $message])]);
    }
}

/** استجابة HTTP تُرمى كاستثناء (تحويل، صفحة خطأ، تنزيل) وتعالَج في ERP_Router::handle. */
final class ERP_Http_Response extends Exception
{
    public $response;

    public function __construct(array $response)
    {
        parent::__construct('http');
        $this->response = $response;
    }
}
