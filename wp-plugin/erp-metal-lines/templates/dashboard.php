<?php defined('ABSPATH') || exit; ?>
<div class="d-flex align-items-center mb-3">
  <h1 class="page-title"><i class="bi bi-speedometer2"></i> لوحة التحكم</h1>
  <?php if ($drafts) : ?><a href="<?php echo esc_url(erp_url('/journal/', ['state' => 'draft'])); ?>" class="badge text-bg-warning ms-3 text-decoration-none"><?php echo (int) $drafts; ?> مستند مسودة بانتظار الترحيل</a><?php endif; ?>
</div>
<?php if ($show_steps) : ?>
<div class="card mb-3" style="border-color:#7fc8c1"><div class="card-header" style="background:#dff3f1;color:#0b3b38"><i class="bi bi-flag"></i> ابدأ من هنا — خطوات تجهيز البرنامج</div>
<div class="card-body py-2"><ol class="mb-0 d-flex flex-wrap gap-2 list-unstyled">
<?php foreach ($steps as $i => [$label, $url, $done]) : ?><li><a href="<?php echo esc_url(home_url($url)); ?>" class="btn btn-sm <?php echo $done ? 'btn-success' : 'btn-outline-primary'; ?>"><span class="badge text-bg-light me-1"><?php echo (int) $i + 1; ?></span><?php if ($done) : ?><i class="bi bi-check2"></i> <?php endif; ?><?php echo erp_e($label); ?></a></li><?php endforeach; ?>
</ol></div></div>
<?php endif; ?>
<div class="row g-3 mb-3">
<?php foreach ([['bg-g1', 'bi-cash-stack', 'النقدية والبنوك', $cash], ['bg-g2', 'bi-person-down', 'مستحق من العملاء', $receivable], ['bg-g3', 'bi-person-up', 'مستحق للموردين والمقاولين', $payable], ['bg-g5', 'bi-graph-up', 'إيرادات السنة', $revenue], ['bg-g4', 'bi-graph-down', 'تكاليف ومصروفات السنة', $expense], ['bg-g6', 'bi-trophy', 'صافي الربح', $profit]] as [$bg, $ic, $lbl, $v]) : ?>
  <div class="col-xl-2 col-md-4 col-6"><div class="kpi <?php echo erp_a($bg); ?>"><i class="bi <?php echo erp_a($ic); ?>"></i><div class="label"><?php echo erp_e($lbl); ?></div><div class="value"><?php echo erp_e(erp_money0($v)); ?></div></div></div>
<?php endforeach; ?>
</div>
<div class="row g-3 mb-3">
  <div class="col-lg-8"><div class="card h-100"><div class="card-header"><i class="bi bi-bar-chart"></i> الإيرادات والمصروفات - آخر 12 شهراً</div><div class="card-body"><canvas id="chart" height="110"></canvas></div></div></div>
  <div class="col-lg-4"><div class="card h-100"><div class="card-header"><i class="bi bi-safe"></i> أرصدة الخزائن والبنوك</div>
    <table class="table table-sm"><tbody>
    <?php foreach ($treasury as $t) : ?><tr><td><a href="<?php echo esc_url(erp_url('/reports/ledger/', ['account' => $t['account']['id']])); ?>"><?php echo erp_e($t['account']['name']); ?></a></td><td class="num"><?php echo erp_e(erp_money0($t['balance'])); ?></td></tr><?php endforeach; ?>
    </tbody></table></div></div>
</div>
<div class="card"><div class="card-header"><i class="bi bi-clock-history"></i> آخر القيود</div>
  <table class="table table-sm table-hover"><tbody>
  <?php foreach ($recent as $e) : ?><tr class="clickable" data-href="<?php echo esc_url(home_url("/journal/{$e['id']}/")); ?>"><td><?php echo erp_e($e['number']); ?></td><td><?php echo erp_e(erp_date($e['date'])); ?></td><td><?php echo erp_e(mb_strimwidth($e['memo'], 0, 50, '…')); ?></td><td><span class="badge text-bg-light"><?php echo erp_e(ERP_DB::display('journal_entry', 'source', $e['source'])); ?></span></td></tr><?php endforeach; ?>
  <?php if (!$recent) : ?><tr><td class="text-muted text-center">لا توجد قيود</td></tr><?php endif; ?>
  </tbody></table></div>
<script src="<?php echo esc_url(ERP_Templates::asset('vendor/chart.umd.min.js')); ?>"></script>
<script>
const d = <?php echo wp_json_encode($chart); ?>;
Chart.defaults.font.family = "Plex Arabic";
new Chart(document.getElementById("chart"), {type: "bar", data: {labels: d.labels, datasets: [
  {label: "الإيرادات", data: d.revenue, backgroundColor: "#0f6e6a", borderRadius: 4},
  {label: "التكاليف والمصروفات", data: d.expense, backgroundColor: "#c27c0e", borderRadius: 4}]},
  options: {plugins: {legend: {position: "bottom"}}, scales: {y: {ticks: {callback: v => v.toLocaleString()}}}}});
</script>
