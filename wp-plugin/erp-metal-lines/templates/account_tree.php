<?php defined('ABSPATH') || exit; ?>
<div class="d-flex align-items-center mb-3"><h1 class="page-title"><i class="bi bi-diagram-3"></i> شجرة الحسابات</h1>
<div class="ms-auto d-flex gap-2"><input id="filter" class="form-control form-control-sm" placeholder="بحث بالكود أو الاسم" style="width:220px">
<button type="button" class="btn btn-sm btn-outline-success" onclick="exportTable(this,'شجرة الحسابات')"><i class="bi bi-file-earmark-excel"></i> Excel</button>
<?php if (current_user_can('erp_manage_accounts')) : ?><a href="<?php echo esc_url(home_url('/accounts/new/')); ?>" class="btn btn-sm btn-primary"><i class="bi bi-plus-lg"></i> حساب جديد</a><?php endif; ?></div></div>
<div class="card"><table class="table table-sm table-hover align-middle exportable" id="tree"><thead><tr><th>الكود</th><th>اسم الحساب</th><th>النوع</th><th>طبيعة خاصة</th><th class="num">الرصيد</th><th class="no-print"></th></tr></thead><tbody>
<?php foreach ($rows as $r) : $a = $r['a']; ?>
<tr class="<?php echo (int) $a['is_group'] ? 'grp' : ''; ?> <?php echo $r['level'] === 0 ? 'lvl0' : ''; ?> <?php echo (int) $a['active'] ? '' : 'text-muted'; ?>">
<td><?php echo erp_e($a['code']); ?></td><td style="padding-right:calc(<?php echo (int) $r['level']; ?> * 1.5rem + .5rem)"><?php if ((int) $a['is_group']) : ?><i class="bi bi-folder2-open text-warning"></i><?php else : ?><i class="bi bi-file-earmark text-secondary"></i><?php endif; ?> <?php echo erp_e($a['name']); ?></td>
<td><?php echo erp_e(ERP_DB::display('account', 'type', $a['type'])); ?></td><td><?php if ($a['kind'] !== 'other') : ?><span class="badge text-bg-info"><?php echo erp_e(ERP_DB::display('account', 'kind', $a['kind'])); ?></span><?php endif; ?></td>
<td class="num"><?php echo erp_e(erp_money($r['balance'])); ?></td>
<td class="no-print text-nowrap"><?php if ((int) $a['is_group']) : ?><?php if (current_user_can('erp_manage_accounts')) : ?><a href="<?php echo esc_url(erp_url('/accounts/new/', ['parent' => $a['id']])); ?>" class="btn btn-sm btn-link p-0" title="إضافة حساب فرعي"><i class="bi bi-plus-circle"></i></a><?php endif; ?><?php else : ?><a href="<?php echo esc_url(erp_url('/reports/ledger/', ['account' => $a['id']])); ?>" class="btn btn-sm btn-link p-0" title="كشف الحساب"><i class="bi bi-journal-text"></i></a><?php endif; ?>
<?php if (current_user_can('erp_manage_accounts')) : ?><a href="<?php echo esc_url(home_url("/accounts/{$a['id']}/")); ?>" class="btn btn-sm btn-link p-0" title="تعديل"><i class="bi bi-pencil"></i></a>
<form method="post" action="<?php echo esc_url(home_url("/accounts/{$a['id']}/delete/")); ?>" class="d-inline" data-confirm="حذف الحساب <?php echo erp_a($a['code']); ?>؟"><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?><button class="btn btn-sm btn-link p-0 text-danger" title="حذف"><i class="bi bi-trash"></i></button></form><?php endif; ?></td></tr>
<?php endforeach; ?>
</tbody></table></div>
<script>
document.getElementById("filter").addEventListener("input", function(){const q=this.value.trim();document.querySelectorAll("#tree tbody tr").forEach(tr=>{tr.style.display=!q||tr.innerText.includes(q)?"":"none";});});
</script>
