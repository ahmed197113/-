<?php defined('ABSPATH') || exit; ?>
<h1 class="page-title mb-3"><i class="bi bi-lock"></i> <?php echo erp_e($title); ?></h1>
<div class="alert alert-info py-2 small"><i class="bi bi-info-circle"></i> ينشئ قيداً يُقفل أرصدة الإيرادات والمصروفات للفترة في حساب الأرباح المرحلة، ثم يقفل الفترة ضد التعديل.</div>
<form method="post" novalidate class="card card-body" style="max-width:720px"><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?>
<?php if ($non_field_error) : ?><div class="alert alert-danger py-2"><?php echo erp_e($non_field_error); ?></div><?php endif; ?>
<div class="row g-3">
<?php foreach (['date_from' => 'من تاريخ', 'date_to' => 'إلى تاريخ (تاريخ قيد الإقفال)'] as $k => $lbl) : ?><div class="col-md-6"><label class="form-label small mb-1" for="id_<?php echo $k; ?>"><?php echo erp_e($lbl); ?> <span class="text-danger">*</span></label><input type="date" class="form-control form-control-sm" name="<?php echo $k; ?>" id="id_<?php echo $k; ?>" value="<?php echo erp_a($values[$k]); ?>"><?php if (isset($errors[$k])) : ?><ul class="errorlist"><li><?php echo erp_e($errors[$k]); ?></li></ul><?php endif; ?></div><?php endforeach; ?>
<div class="col-12"><div class="form-check"><input type="checkbox" class="form-check-input" name="lock" id="id_lock" value="1"<?php echo $values['lock'] !== '' ? ' checked' : ''; ?>> <label class="form-check-label" for="id_lock">إقفال الفترة بعد إنشاء القيد</label></div></div>
</div><div class="mt-3"><button class="btn btn-primary" data-confirm-text="إنشاء قيد الإقفال؟"><i class="bi bi-save"></i> إنشاء قيد الإقفال</button></div></form>
