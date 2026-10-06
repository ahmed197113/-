<?php defined('ABSPATH') || exit; ?>
<h1 class="page-title mb-3"><i class="bi bi-gear"></i> الإعدادات</h1>
<div class="row g-3"><div class="col-lg-8"><form method="post" class="card" novalidate><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?><div class="card-header">بيانات الشركة والفترة المالية</div><div class="card-body"><div class="row g-2">
<?php foreach ($fields as $name => $opts) {
    echo ERP_UI::field_html('company', $name, $opts, $values[$name] ?? '', $errors[$name] ?? null); // phpcs:ignore
} ?></div><button class="btn btn-primary mt-3"><i class="bi bi-save"></i> حفظ</button></div></form></div>
<div class="col-lg-4"><div class="list-group">
<a href="<?php echo esc_url(home_url('/settings/mapping/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-signpost-split"></i> التوجيه المحاسبي للقيود الآلية</a>
<a href="<?php echo esc_url(home_url('/taxes/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-percent"></i> الضرائب (قيمة مضافة / خصم وإضافة)</a>
<a href="<?php echo esc_url(home_url('/cost-centers/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-bullseye"></i> مراكز التكلفة</a>
<a href="<?php echo esc_url(home_url('/journal/templates/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-lightning-charge"></i> القيود الجاهزة</a>
<a href="<?php echo esc_url(home_url('/journal/new/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-flag"></i> قيد أرصدة افتتاحية (اختر نوع: قيد افتتاحي)</a>
<a href="<?php echo esc_url(home_url('/settings/close-year/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-lock"></i> إقفال السنة المالية</a>
<?php if (current_user_can('erp_admin')) : ?>
<a href="<?php echo esc_url(home_url('/settings/backup/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-cloud-download"></i> تنزيل نسخة احتياطية</a>
<a href="<?php echo esc_url(home_url('/settings/system/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-shield-lock"></i> إدارة النظام (تهيئة / مسح / استرجاع)</a>
<a href="<?php echo esc_url(home_url('/settings/audit/')); ?>" class="list-group-item list-group-item-action"><i class="bi bi-shield-check"></i> سجل التدقيق</a>
<?php endif; ?>
</div></div></div>
