<?php
/**
 * جدول سطور (formset) بنفس أسماء حقول Django حتى يعمل app.js كما هو.
 * المتغيرات: $fs = [prefix, title, table, fields => [name => opts], rows => [[values], errors]], non_form_error
 */
defined('ABSPATH') || exit;
$prefix = $fs['prefix'];
$cell_cls = function ($name) {
    return in_array($name, ['account', 'product', 'item'], true) ? 'acc' : (in_array($name, ['description', 'label'], true) ? 'desc' : '');
};
?>
<div class="card mb-3"><div class="card-header d-flex align-items-center"><span><?php echo erp_e($fs['title']); ?></span><button type="button" class="btn btn-sm btn-outline-primary ms-auto" onclick="addFormRow('<?php echo erp_a($prefix); ?>')"><i class="bi bi-plus"></i> إضافة سطر</button></div>
<div class="table-responsive"><table class="table table-sm formset-table mb-0" id="<?php echo erp_a($prefix); ?>-table">
<input type="hidden" name="<?php echo erp_a($prefix); ?>-TOTAL_FORMS" id="id_<?php echo erp_a($prefix); ?>-TOTAL_FORMS" value="<?php echo count($fs['rows']); ?>">
<?php if (!empty($fs['non_form_error'])) : ?><caption class="text-danger px-2" style="caption-side:top"><ul class="errorlist"><li><?php echo erp_e($fs['non_form_error']); ?></li></ul></caption><?php endif; ?>
<thead><tr><?php foreach ($fs['fields'] as $name => $opts) : ?><th><?php echo erp_e($opts['label'] ?? ERP_DB::label($fs['table'], $name)); ?></th><?php endforeach; ?><th></th></tr></thead>
<tbody id="<?php echo erp_a($prefix); ?>-body">
<?php foreach ($fs['rows'] as $i => [$vals, $errs]) : ?>
<tr><?php foreach ($fs['fields'] as $name => $opts) : ?><td class="<?php echo erp_a($cell_cls($name)); ?>"><?php echo ERP_UI::field_html($fs['table'], $name, $opts, $vals[$name] ?? '', $errs[$name] ?? null, "{$prefix}-{$i}-", '', true); // phpcs:ignore ?></td><?php endforeach; ?>
<td><span class="d-none"><input type="checkbox" name="<?php echo erp_a("{$prefix}-{$i}-DELETE"); ?>" value="1"></span><button type="button" class="btn btn-sm btn-link text-danger" onclick="removeFormRow(this)"><i class="bi bi-trash"></i></button><?php if (!empty($errs['__all__'])) : ?><div class="text-danger small"><?php echo erp_e($errs['__all__']); ?></div><?php endif; ?></td></tr>
<?php endforeach; ?>
</tbody>
</table></div>
<template id="<?php echo erp_a($prefix); ?>-empty"><tr><?php foreach ($fs['fields'] as $name => $opts) : ?><td class="<?php echo erp_a($cell_cls($name)); ?>"><?php echo ERP_UI::field_html($fs['table'], $name, $opts, $fs['empty'][$name] ?? '', null, "{$prefix}-__prefix__-", '', true); // phpcs:ignore ?></td><?php endforeach; ?><td><button type="button" class="btn btn-sm btn-link text-danger" onclick="removeFormRow(this)"><i class="bi bi-trash"></i></button></td></tr></template>
</div>
