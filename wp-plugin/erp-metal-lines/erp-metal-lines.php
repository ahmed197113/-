<?php
/**
 * Plugin Name:       نظام المحاسبة والمقاولات — الخطوط المعدنية
 * Description:       نقل حرفي لبرنامج المحاسبة والمقاولات (Django) كإضافة WordPress: قيود آلية، مستخلصات، تقارير. مخصص لتثبيت WordPress منفصل على erp.metal-lines.com.
 * Version:           0.1.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            الخطوط المعدنية للمقاولات العامة
 * Text Domain:       erp-metal-lines
 */
defined('ABSPATH') || exit;

define('ERP_VERSION', '0.1.0');
define('ERP_PLUGIN_FILE', __FILE__);
define('ERP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ERP_PLUGIN_URL', plugin_dir_url(__FILE__));

foreach (['money', 'db', 'schema', 'caps', 'core', 'seed', 'reports', 'backup', 'templates', 'ui', 'router', 'views'] as $f) {
    $path = ERP_PLUGIN_DIR . "includes/class-erp-{$f}.php";
    if (file_exists($path)) {
        require_once $path;
    }
}

/** فحص المتطلبات قبل التفعيل: PHP 8.1+ و bcmath و InnoDB. */
function erp_requirements_errors(): array
{
    $errors = [];
    if (version_compare(PHP_VERSION, '8.1', '<')) {
        $errors[] = 'الإضافة تتطلب PHP 8.1 أو أحدث (الحالي ' . PHP_VERSION . ').';
    }
    if (!function_exists('bcadd')) {
        $errors[] = 'امتداد PHP «bcmath» غير مفعّل على الاستضافة — مطلوب لدقة الحسابات المالية.';
    }
    return $errors;
}

register_activation_hook(__FILE__, function () {
    $errors = erp_requirements_errors();
    if ($errors) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(esc_html(implode(' ', $errors)), 'متطلبات غير متوفرة', ['back_link' => true]);
    }
    ERP_Schema::install();
    ERP_Caps::install();
    update_option('users_can_register', 0);
});

add_action('plugins_loaded', function () {
    if (erp_requirements_errors()) {
        return;
    }
    ERP_Schema::maybe_upgrade();
    if (class_exists('ERP_Router')) {
        ERP_Router::init();
    }
});
