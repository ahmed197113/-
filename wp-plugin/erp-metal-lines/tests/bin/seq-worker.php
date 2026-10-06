<?php
/* عملية منفصلة تولّد أرقاماً تسلسلية على نفس قاعدة الاختبار — لاختبار التزامن الحقيقي. */
require dirname(__DIR__) . '/wp-tests-config.php';
define('WP_USE_THEMES', false);
$_SERVER['HTTP_HOST'] = WP_TESTS_DOMAIN;
$_SERVER['SERVER_NAME'] = WP_TESTS_DOMAIN;
$_SERVER['REQUEST_URI'] = '/';
require ABSPATH . 'wp-settings.php';
require_once dirname(__DIR__, 2) . '/erp-metal-lines.php';
$n = (int) ($argv[1] ?? 50);
$out = [];
for ($i = 0; $i < $n; $i++) {
    $out[] = ERP_Sequence::next('JE');
    usleep(random_int(0, 2000));
}
echo json_encode($out);
