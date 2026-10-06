<?php
/* إعدادات بيئة الاختبار — قاعدة بيانات منفصلة تماماً (تُمسح جداولها مع كل تشغيل). */
define('ABSPATH', dirname(__DIR__) . '/vendor/johnpbloch/wordpress-core/');
define('WP_DEFAULT_THEME', 'default');
define('WP_DEBUG', true);
define('DB_NAME', getenv('ERP_TEST_DB_NAME') ?: 'wp_erp_tests');
define('DB_USER', getenv('ERP_TEST_DB_USER') ?: 'wp');
define('DB_PASSWORD', getenv('ERP_TEST_DB_PASSWORD') ?: 'wp');
define('DB_HOST', getenv('ERP_TEST_DB_HOST') ?: 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
$table_prefix = 'wptests_';
define('WP_TESTS_DOMAIN', 'example.org');
define('WP_TESTS_EMAIL', 'admin@example.org');
define('WP_TESTS_TITLE', 'ERP Tests');
define('WP_PHP_BINARY', 'php');
define('WPLANG', 'ar');
