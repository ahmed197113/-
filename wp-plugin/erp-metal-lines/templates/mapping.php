<?php defined('ABSPATH') || exit; ?>
<div class="d-flex align-items-center mb-3"><h1 class="page-title"><i class="bi bi-signpost-split"></i> <?php echo erp_e($title); ?></h1></div>
<div class="alert alert-info py-2 small"><i class="bi bi-info-circle"></i> هنا تحدد الحساب الذي يستخدمه البرنامج تلقائياً لكل نوع من الحركات عند ترحيل الفواتير والسندات والمستخلصات.</div>
<form method="post" novalidate><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?><div class="card mb-3"><div class="card-body"><div class="row g-3">
<?php foreach ($roles as $role => $label) : ?><div class="col-md-4"><label class="form-label small mb-1" for="id_<?php echo erp_a($role); ?>"><?php echo erp_e($label); ?></label>
<select class="form-select form-select-sm searchable" name="<?php echo erp_a($role); ?>" id="id_<?php echo erp_a($role); ?>"><option value="">---------</option><?php foreach ($accs as $id => $lbl) : ?><option value="<?php echo (int) $id; ?>"<?php echo (string) ($current[$role] ?? '') === (string) $id ? ' selected' : ''; ?>><?php echo erp_e($lbl); ?></option><?php endforeach; ?></select>
<?php if (isset($errors[$role])) : ?><ul class="errorlist"><li><?php echo erp_e($errors[$role]); ?></li></ul><?php endif; ?></div><?php endforeach; ?>
</div></div></div><button class="btn btn-primary"><i class="bi bi-save"></i> حفظ</button></form>
