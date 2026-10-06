<?php defined('ABSPATH') || exit;
$cards = [
    ['/reports/trial-balance/', 'bi-scale', 'text-primary', 'ميزان المراجعة', 'أرصدة أول المدة والحركة والختامي بمستويات الشجرة'],
    ['/reports/ledger/', 'bi-journal-text', 'text-secondary', 'دفتر الأستاذ / كشف حساب', 'حركة أي حساب برصيد تراكمي — ويستخدم كدفتر خزينة وبنك'],
    ['/reports/partner-statement/', 'bi-person-lines-fill', 'text-primary', 'كشف حساب عميل / مورد / مقاول', 'شامل المحتجزات والدفعات المقدمة'],
];
?>
<h1 class="page-title mb-3"><i class="bi bi-graph-up-arrow"></i> التقارير المالية</h1>
<div class="row g-3"><?php foreach ($cards as [$url, $ic, $color, $t, $d]) : ?>
<div class="col-xl-3 col-md-4"><a class="card card-body h-100 text-decoration-none" href="<?php echo esc_url(home_url($url)); ?>"><i class="bi <?php echo erp_a($ic . ' ' . $color); ?> fs-2"></i><h6 class="fw-bold mt-2"><?php echo erp_e($t); ?></h6><small class="text-muted"><?php echo erp_e($d); ?></small></a></div>
<?php endforeach; ?></div>
<div class="alert alert-light border small mt-3">باقي التقارير (قائمة الدخل، المركز المالي، الضرائب، أعمار الديون، مراكز التكلفة، تقارير المقاولات) تُسلَّم في المرحلة الرابعة.</div>
