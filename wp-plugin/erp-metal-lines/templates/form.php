<?php
/**
 * النموذج العام — نسخة من generic/form.html.
 * المتغيرات: title, icon, table, fields [name => opts], values, errors, non_field_error, formsets, help, extra_html, cls
 */
defined('ABSPATH') || exit;
?>
<div class="d-flex align-items-center mb-3"><h1 class="page-title"><i class="bi <?php echo erp_a($icon ?? 'bi-pencil-square'); ?>"></i> <?php echo erp_e($title); ?></h1>
  <a href="javascript:history.back()" class="btn btn-sm btn-light ms-auto"><i class="bi bi-arrow-right"></i> رجوع</a></div>
<?php if (!empty($help)) : ?><div class="alert alert-info py-2 small"><i class="bi bi-info-circle"></i> <?php echo erp_e($help); ?></div><?php endif; ?>
<form method="post" novalidate>
  <?php echo ERP_UI::nonce_field(); // phpcs:ignore ?>
  <?php if (!empty($non_field_error)) : ?><div class="alert alert-danger py-2"><?php echo erp_e($non_field_error); ?></div><?php endif; ?>
  <div class="card mb-3"><div class="card-body"><div class="row g-3">
    <?php foreach ($fields as $name => $opts) {
        echo ERP_UI::field_html($table, $name, $opts, $values[$name] ?? '', $errors[$name] ?? null, '', $opts['cls'] ?? ($cls ?? 'col-md-4')); // phpcs:ignore
    } ?>
  </div></div></div>
  <?php foreach ($formsets ?? [] as $fs) {
      include __DIR__ . '/_formset.php';
  } ?>
  <?php echo $extra_html ?? ''; // phpcs:ignore ?>
  <div class="d-flex gap-2"><button class="btn btn-primary"><i class="bi bi-save"></i> حفظ</button>
  <a href="javascript:history.back()" class="btn btn-light">إلغاء</a></div>
</form>
