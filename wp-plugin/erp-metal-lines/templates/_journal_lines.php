<?php
/**
 * سطور القيد بتخطيط موسّع: كل سطر بطاقة من صفين بعناوين وشرح لكل خانة.
 * أسماء الحقول مطابقة لـ Django (lines-N-field) حتى يعمل app.js كما هو.
 * المتغيرات: $fs (prefix, fields, rows, non_form_error, empty)
 */
defined('ABSPATH') || exit;
$prefix = $fs['prefix'];
$help = [
    'account' => 'الحساب التحليلي الذي يتأثر بهذا السطر. ابحث بالكود أو الاسم. الحسابات التجميعية لا تقبل قيوداً.',
    'debit' => 'المبلغ المدين: زيادة في أصل أو مصروف، أو نقص في التزام أو إيراد. اتركه صفراً إن كان السطر دائناً.',
    'credit' => 'المبلغ الدائن: زيادة في التزام أو إيراد أو حقوق ملكية، أو نقص في أصل. اتركه صفراً إن كان السطر مديناً.',
    'label' => 'شرح تفصيلي للسطر يظهر في دفتر الأستاذ وكشف الحساب (حتى 300 حرف). لو تُرك فارغاً يظهر بيان القيد.',
    'partner' => 'العميل أو المورد أو مقاول الباطن الذي يخصه السطر — حدده حتى يظهر المبلغ في كشف حسابه ورصيده.',
    'project' => 'المشروع الذي يُحمّل عليه الإيراد أو التكلفة حتى يظهر في تقرير ربحيته.',
    'cost_center' => 'مركز التكلفة (الإدارة أو القطاع) للتحليل الإداري للمصروفات والإيرادات.',
];
$cell = function (string $name, $vals, $errs, string $pfx, string $cls) use ($fs, $help) {
    $opts = $fs['fields'][$name];
    $label = ERP_DB::label('journal_line', $name);
    $id = 'id_' . $pfx . $name;
    if ($name === 'label') {
        $input = '<textarea class="form-control form-control-sm jl-label" rows="2" maxlength="300" name="' . erp_a($pfx . $name)
            . '" id="' . erp_a($id) . '" placeholder="اكتب شرح العملية بالتفصيل…">' . esc_textarea((string) ($vals[$name] ?? '')) . '</textarea>';
        if (!empty($errs[$name])) {
            $input .= '<ul class="errorlist"><li>' . erp_e($errs[$name]) . '</li></ul>';
        }
    } else {
        $input = ERP_UI::field_html('journal_line', $name, $opts, $vals[$name] ?? '', $errs[$name] ?? null, $pfx, '', true);
    }
    return '<div class="' . erp_a($cls) . '"><label class="form-label small mb-1" for="' . erp_a($id) . '">' . erp_e($label)
        . ($name === 'account' ? ' <span class="text-danger">*</span>' : '')
        . ' <i class="bi bi-question-circle text-muted" tabindex="0" data-bs-toggle="tooltip" title="' . erp_a($help[$name]) . '"></i></label>'
        . $input . '</div>';
};
$line = function ($vals, $errs, string $pfx, bool $with_delete) use ($cell) {
    $h = '<tr class="jl-row"><td><div class="jl-line"><div class="jl-num"></div><div class="row g-2 flex-grow-1">'
        . $cell('account', $vals, $errs, $pfx, 'col-lg-6 col-md-12')
        . $cell('debit', $vals, $errs, $pfx, 'col-lg-3 col-6')
        . $cell('credit', $vals, $errs, $pfx, 'col-lg-3 col-6')
        . $cell('label', $vals, $errs, $pfx, 'col-lg-6 col-md-12')
        . $cell('partner', $vals, $errs, $pfx, 'col-lg-2 col-md-4')
        . $cell('project', $vals, $errs, $pfx, 'col-lg-2 col-md-4')
        . $cell('cost_center', $vals, $errs, $pfx, 'col-lg-2 col-md-4')
        . '</div><div class="jl-actions">';
    if ($with_delete) {
        $h .= '<span class="d-none"><input type="checkbox" name="' . erp_a($pfx . 'DELETE') . '" value="1"></span>';
    }
    $h .= '<button type="button" class="btn btn-sm btn-outline-danger" title="حذف السطر" onclick="removeFormRow(this)"><i class="bi bi-trash"></i></button>';
    if (!empty($errs['__all__'])) {
        $h .= '<div class="text-danger small">' . erp_e($errs['__all__']) . '</div>';
    }
    return $h . '</div></div></td></tr>';
};
?>
<div class="card mb-3"><div class="card-header d-flex align-items-center flex-wrap gap-2"><span><i class="bi bi-list-ol"></i> سطور القيد</span>
<button type="button" class="btn btn-sm btn-link ms-auto" data-bs-toggle="collapse" data-bs-target="#jl-guide"><i class="bi bi-info-circle"></i> شرح الحقول</button>
<button type="button" class="btn btn-sm btn-outline-primary" onclick="addFormRow('<?php echo erp_a($prefix); ?>')"><i class="bi bi-plus"></i> إضافة سطر</button></div>
<div class="collapse" id="jl-guide"><div class="card-body small border-bottom jl-guide">
<p class="mb-2"><b>كل سطر</b> يمثل طرفاً من أطراف القيد: حساب واحد بمبلغ مدين <b>أو</b> دائن (ليس الاثنين معاً). يجب أن يتساوى إجمالي المدين مع إجمالي الدائن، وأن يحتوي القيد على سطرين على الأقل.</p>
<dl class="row mb-0">
<?php foreach ($help as $k => $txt) : ?><dt class="col-sm-2"><?php echo erp_e(ERP_DB::label('journal_line', $k)); ?></dt><dd class="col-sm-10"><?php echo erp_e($txt); ?></dd><?php endforeach; ?>
</dl></div></div>
<table class="table mb-0 jl-table" id="<?php echo erp_a($prefix); ?>-table">
<input type="hidden" name="<?php echo erp_a($prefix); ?>-TOTAL_FORMS" id="id_<?php echo erp_a($prefix); ?>-TOTAL_FORMS" value="<?php echo count($fs['rows']); ?>">
<?php if (!empty($fs['non_form_error'])) : ?><caption class="text-danger px-3" style="caption-side:top"><ul class="errorlist"><li><?php echo erp_e($fs['non_form_error']); ?></li></ul></caption><?php endif; ?>
<tbody id="<?php echo erp_a($prefix); ?>-body">
<?php foreach ($fs['rows'] as $i => [$vals, $errs]) {
    echo $line($vals, $errs, "{$prefix}-{$i}-", true); // phpcs:ignore — الحقول مُهرّبة داخل الدوال
} ?>
</tbody>
</table>
<template id="<?php echo erp_a($prefix); ?>-empty"><?php echo $line($fs['empty'], [], "{$prefix}-__prefix__-", false); // phpcs:ignore ?></template>
</div>
<script>
(function () {
  function grow(t) { t.style.height = "auto"; t.style.height = (t.scrollHeight + 2) + "px"; }
  function tips(root) { if (window.bootstrap) (root || document).querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) { bootstrap.Tooltip.getOrCreateInstance(el); }); }
  document.addEventListener("input", function (e) { if (e.target.classList.contains("jl-label")) grow(e.target); });
  document.addEventListener("formset:added", function (e) { tips(e.detail.row); });
  document.addEventListener("DOMContentLoaded", function () { document.querySelectorAll(".jl-label").forEach(grow); tips(); });
})();
</script>
