<?php defined('ABSPATH') || exit; ?>
<div class="d-flex align-items-center mb-3"><h1 class="page-title"><i class="bi bi-journal-plus"></i> <?php echo erp_e($title); ?><?php echo $obj ? ' ' . erp_e($obj['number']) : ''; ?></h1>
<a href="<?php echo esc_url(home_url('/journal/templates/')); ?>" class="btn btn-sm btn-warning ms-auto"><i class="bi bi-lightning-charge"></i> استخدم قيداً جاهزاً بدلاً من ذلك</a></div>
<form method="post" novalidate>
<?php echo ERP_UI::nonce_field(); // phpcs:ignore ?>
<?php if ($non_field_error) : ?><div class="alert alert-danger"><?php echo erp_e($non_field_error); ?></div><?php endif; ?>
<div class="card mb-3"><div class="card-body"><div class="row g-2">
<?php foreach ($fields as $name => $opts) {
    echo ERP_UI::field_html($table, $name, $opts, $values[$name] ?? '', $errors[$name] ?? null, '', 'col-md-3'); // phpcs:ignore
} ?>
</div></div></div>
<?php include __DIR__ . '/_formset.php'; ?>
<div class="card mb-3"><div class="card-body d-flex gap-4 align-items-center"><div>إجمالي المدين: <b class="num" id="td">0.00</b></div><div>إجمالي الدائن: <b class="num" id="tc">0.00</b></div><div id="diff" class="fw-bold"></div></div></div>
<button class="btn btn-primary"><i class="bi bi-save"></i> حفظ كمسودة</button>
</form>
<script>
function bal(){let d=0,c=0;document.querySelectorAll("#lines-body tr").forEach(tr=>{if(tr.style.display==="none")return;d+=num(tr.querySelector("[name$='-debit']").value);c+=num(tr.querySelector("[name$='-credit']").value);});
document.getElementById("td").textContent=fmt(d);document.getElementById("tc").textContent=fmt(c);const df=Math.round((d-c)*100)/100;const el=document.getElementById("diff");
el.textContent=df===0?"✔ القيد متزن":"الفرق: "+fmt(df);el.className="fw-bold "+(df===0?"text-success":"text-danger");}
document.addEventListener("input",bal);document.addEventListener("formset:changed",bal);bal();
</script>
