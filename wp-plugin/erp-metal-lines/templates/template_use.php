<?php defined('ABSPATH') || exit;
$sel = function ($name, $label, $opts, $req) use ($values, $errors) {
    $h = '<div class="col-md-6"><label class="form-label small mb-1" for="id_' . $name . '">' . erp_e($label) . ($req ? ' <span class="text-danger">*</span>' : '')
        . '</label><select class="form-select form-select-sm searchable" name="' . $name . '" id="id_' . $name . '"><option value="">---------</option>';
    foreach ($opts as $k => $v) {
        $h .= '<option value="' . erp_a($k) . '"' . ((string) ($values[$name] ?? '') === (string) $k ? ' selected' : '') . '>' . erp_e($v) . '</option>';
    }
    return $h . '</select>' . (isset($errors[$name]) ? '<ul class="errorlist"><li>' . erp_e($errors[$name]) . '</li></ul>' : '') . '</div>';
};
$inp = function ($name, $label, $type, $req) use ($values, $errors) {
    return '<div class="col-md-6"><label class="form-label small mb-1" for="id_' . $name . '">' . erp_e($label) . ($req ? ' <span class="text-danger">*</span>' : '')
        . '</label><input type="' . $type . '" class="form-control form-control-sm' . ($name === 'amount' ? ' num' : '') . '" name="' . $name . '" id="id_' . $name . '" value="' . erp_a($values[$name] ?? '') . '">'
        . (isset($errors[$name]) ? '<ul class="errorlist"><li>' . erp_e($errors[$name]) . '</li></ul>' : '') . '</div>';
};
?>
<h1 class="page-title mb-3"><i class="bi bi-lightning-charge"></i> <?php echo erp_e($title); ?></h1>
<div class="row g-3"><div class="col-lg-7"><form method="post" class="card card-body" novalidate><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?>
<?php if ($non_field_error) : ?><div class="alert alert-danger"><?php echo erp_e($non_field_error); ?></div><?php endif; ?>
<div class="row g-2">
<?php echo $inp('date', 'التاريخ', 'date', true) . $inp('amount', 'المبلغ', 'text', true) . $inp('memo', 'البيان', 'text', false) . $inp('reference', 'المرجع', 'text', false)
    . $sel('partner', 'جهة التعامل', $partners, (bool) (int) $t['ask_partner']) . $sel('project', 'المشروع', $projects, (bool) (int) $t['ask_project'])
    . $sel('cost_center', 'مركز التكلفة', $ccs, false); // phpcs:ignore ?>
<div class="col-md-6"><div class="form-check mt-4"><input type="checkbox" class="form-check-input" name="post_now" id="id_post_now" value="1"<?php echo !empty($values['post_now']) ? ' checked' : ''; ?>> <label class="form-check-label" for="id_post_now">ترحيل فوري</label></div></div>
</div>
<button class="btn btn-success mt-3"><i class="bi bi-check2-circle"></i> إنشاء القيد</button></form></div>
<div class="col-lg-5"><div class="card"><div class="card-header">معاينة القيد</div><table class="table table-sm mb-0"><thead><tr><th>الحساب</th><th class="num">مدين</th><th class="num">دائن</th></tr></thead><tbody>
<?php foreach ($tlines as $l) : ?><tr data-pct="<?php echo erp_a(ERP_Money::norm($l['percent'])); ?>" data-side="<?php echo erp_a($l['side']); ?>"><td><?php echo erp_e($l['astr']); ?></td><td class="num d"></td><td class="num c"></td></tr><?php endforeach; ?></tbody></table></div></div></div>
<script>
function pv(){const a=num(document.getElementById("id_amount").value);document.querySelectorAll("tr[data-pct]").forEach(tr=>{const v=a*num(tr.dataset.pct)/100;tr.querySelector(".d").textContent=tr.dataset.side==="debit"?fmt(v):"";tr.querySelector(".c").textContent=tr.dataset.side==="credit"?fmt(v):"";});}
document.getElementById("id_amount").addEventListener("input",pv);pv();
</script>
