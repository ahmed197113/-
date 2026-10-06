<?php
/* تشغيل WordPress الحقيقي + الإضافة على قاعدة اختبار منفصلة. */
putenv('WP_PHPUNIT__TESTS_CONFIG=' . __DIR__ . '/wp-tests-config.php');
require dirname(__DIR__) . '/vendor/autoload.php';

// تنظيف جداول الاختبار السابقة (مع المفاتيح الأجنبية) قبل أن يعيد WordPress التثبيت
(function () {
    require __DIR__ . '/wp-tests-config.php';
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->query('SET FOREIGN_KEY_CHECKS = 0');
    $res = $db->query("SHOW TABLES LIKE 'wptests\\_%'");
    while ($row = $res->fetch_row()) {
        $db->query('DROP TABLE IF EXISTS `' . $row[0] . '`');
    }
    $db->close();
})();

$_tests_dir = getenv('WP_PHPUNIT__DIR');
require_once $_tests_dir . '/includes/functions.php';
tests_add_filter('muplugins_loaded', function () {
    require dirname(__DIR__) . '/erp-metal-lines.php';
});
require $_tests_dir . '/includes/bootstrap.php';

ERP_Schema::install();
ERP_Caps::install();
require __DIR__ . '/class-erp-testcase.php';
