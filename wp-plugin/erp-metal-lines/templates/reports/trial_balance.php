<?php defined('ABSPATH') || exit; include __DIR__ . '/_head.php'; ?>
<form class="filters card card-body py-2 mb-3"><div class="row g-2 align-items-end">
<div class="col-auto"><label class="small">من</label><input type="date" name="date_from" value="<?php echo erp_a($date_from); ?>" class="form-control form-control-sm"></div>
<div class="col-auto"><label class="small">إلى</label><input type="date" name="date_to" value="<?php echo erp_a($date_to); ?>" class="form-control form-control-sm"></div>
<div class="col-auto"><label class="small">المستوى</label><select name="level" class="form-select form-select-sm"><option value="all">كل المستويات</option><?php foreach (['0', '1', '2', '3'] as $l) : ?><option value="<?php echo $l; ?>" <?php selected($level, $l); ?>>حتى المستوى <?php echo (int) $l + 1; ?></option><?php endforeach; ?></select></div>
<div class="col-md-2"><label class="small">المشروع</label><select name="project" class="form-select form-select-sm"><option value="">الكل</option><?php foreach ($projects as $id => $n) : ?><option value="<?php echo (int) $id; ?>" <?php selected(ERP_UI::get('project'), (string) $id); ?>><?php echo erp_e($n); ?></option><?php endforeach; ?></select></div>
<div class="col-md-2"><label class="small">مركز التكلفة</label><select name="cost_center" class="form-select form-select-sm"><option value="">الكل</option><?php foreach ($cost_centers as $id => $n) : ?><option value="<?php echo (int) $id; ?>" <?php selected(ERP_UI::get('cost_center'), (string) $id); ?>><?php echo erp_e($n); ?></option><?php endforeach; ?></select></div>
<div class="col-auto form-check mt-4 ms-2"><input type="checkbox" class="form-check-input" name="zero" value="1" id="z" <?php checked($show_zero); ?>><label for="z" class="form-check-label small">إظهار الصفرية</label></div>
<div class="col-auto"><button class="btn btn-sm btn-primary"><i class="bi bi-funnel"></i> عرض</button></div></div></form>
<?php if (!$balanced) : ?><div class="alert alert-danger">تنبيه: الميزان غير متزن!</div><?php endif; ?>
<div class="card"><div class="table-responsive"><table class="table table-sm table-hover exportable">
<thead><tr><th rowspan="2">الكود</th><th rowspan="2">اسم الحساب</th><th colspan="2" class="text-center">رصيد أول المدة</th><th colspan="2" class="text-center">حركة الفترة</th><th colspan="2" class="text-center">الرصيد الختامي</th></tr>
<tr><th class="num">مدين</th><th class="num">دائن</th><th class="num">مدين</th><th class="num">دائن</th><th class="num">مدين</th><th class="num">دائن</th></tr></thead>
<tbody><?php foreach ($rows as $r) : $a = $r['account']; ?>
<tr class="<?php echo $r['is_group'] ? 'grp' : 'clickable'; ?> <?php echo $r['level'] === 0 ? 'lvl0' : ''; ?>"<?php if (!$r['is_group']) : ?> data-href="<?php echo esc_url(erp_url('/reports/ledger/', ['account' => $a['id'], 'date_from' => $date_from, 'date_to' => $date_to])); ?>"<?php endif; ?>>
<td><?php echo erp_e($a['code']); ?></td><td style="padding-right:calc(<?php echo (int) $r['level']; ?> * 1.2rem + .5rem)"><?php echo erp_e($a['name']); ?></td><?php foreach ($r['vals'] as $v) : ?><td class="num"><?php echo erp_e(erp_money($v)); ?></td><?php endforeach; ?></tr>
<?php endforeach; ?></tbody>
<tfoot><tr><td colspan="2">الإجمالي</td><?php foreach ($totals as $v) : ?><td class="num"><?php echo erp_e(erp_money($v)); ?></td><?php endforeach; ?></tr></tfoot></table></div></div>
