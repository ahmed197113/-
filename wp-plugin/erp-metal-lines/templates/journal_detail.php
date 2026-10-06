<?php defined('ABSPATH') || exit; $draft = $e['state'] === 'draft'; $auto = ERP_Journal::is_auto($e); ?>
<div class="d-flex flex-wrap align-items-center gap-2 mb-3 no-print"><h1 class="page-title"><i class="bi bi-journal-text"></i> قيد رقم <?php echo erp_e($e['number']); ?></h1><?php echo erp_state_badge($e['state']); // phpcs:ignore ?><span class="badge text-bg-light"><?php echo erp_e(ERP_DB::display('journal_entry', 'source', $e['source'])); ?></span>
<div class="ms-auto d-flex gap-2">
<?php
$btn = function ($action, $label, $cls, $confirm = '') use ($e) {
    return '<form method="post" action="' . esc_url(home_url("/journal/{$e['id']}/{$action}/")) . '"'
        . ($confirm ? ' data-confirm="' . erp_a($confirm) . '"' : '') . '>' . ERP_UI::nonce_field()
        . '<button class="btn btn-sm ' . erp_a($cls) . '">' . $label . '</button></form>';
};
if ($auto) {
    if ($e['source_url']) {
        echo '<a href="' . esc_url(home_url($e['source_url'])) . '" class="btn btn-sm btn-outline-primary"><i class="bi bi-box-arrow-up-left"></i> المستند الأصلي</a>';
    }
} elseif ($draft) {
    if (current_user_can('erp_edit_entries')) {
        echo '<a href="' . esc_url(home_url("/journal/{$e['id']}/edit/")) . '" class="btn btn-sm btn-primary">تعديل</a>';
    }
    if (current_user_can('erp_post_entries')) {
        echo $btn('post', '<i class="bi bi-check2-circle"></i> ترحيل', 'btn-success'); // phpcs:ignore
        echo $btn('delete', '<i class="bi bi-trash"></i>', 'btn-outline-danger', 'حذف القيد؟'); // phpcs:ignore
    }
} elseif (current_user_can('erp_post_entries')) {
    echo $btn('unpost', 'إلغاء الترحيل', 'btn-outline-warning'); // phpcs:ignore
    echo $btn('reverse', '<i class="bi bi-arrow-repeat"></i> قيد عكسي', 'btn-outline-secondary', 'إنشاء قيد عكسي بتاريخ اليوم؟'); // phpcs:ignore
}
?>
<button type="button" onclick="print()" class="btn btn-sm btn-dark"><i class="bi bi-printer"></i></button></div></div>
<div class="card"><div class="card-body">
<div class="row mb-3"><div class="col-md-3"><b>التاريخ:</b> <?php echo erp_e(erp_date($e['date'])); ?></div><div class="col-md-3"><b>المرجع:</b> <?php echo erp_e($e['reference'] ?: '-'); ?></div><div class="col-md-6"><b>البيان:</b> <?php echo erp_e($e['memo']); ?></div></div>
<table class="table table-sm table-bordered"><thead><tr><th>الحساب</th><th>البيان</th><th>جهة التعامل</th><th>المشروع / مركز التكلفة</th><th class="num">مدين</th><th class="num">دائن</th></tr></thead><tbody>
<?php foreach ($lines as $l) : ?><tr><td><a href="<?php echo esc_url(erp_url('/reports/ledger/', ['account' => $l['account_id']])); ?>"><?php echo erp_e($l['acode'] . ' - ' . $l['aname']); ?></a></td><td class="small"><?php echo erp_e($l['label']); ?></td><td><?php echo erp_e($l['pname'] ?? ''); ?></td><td class="small"><?php echo erp_e($l['ccname'] ?? ''); ?></td><td class="num"><?php echo erp_e(erp_money($l['debit'])); ?></td><td class="num"><?php echo erp_e(erp_money($l['credit'])); ?></td></tr><?php endforeach; ?></tbody>
<tfoot><tr><td colspan="4">الإجمالي <?php echo ERP_Money::cmp($total_debit, $total_credit) === 0 ? '<span class="badge text-bg-success">متزن</span>' : '<span class="badge text-bg-danger">غير متزن</span>'; ?></td><td class="num"><?php echo erp_e(erp_money($total_debit)); ?></td><td class="num"><?php echo erp_e(erp_money($total_credit)); ?></td></tr></tfoot></table>
<div class="tafqeet"><?php echo erp_e(ERP_Tafqeet::amount_to_words($total_debit, $company['currency_name'], $company['currency_sub'])); ?></div>
<div class="small text-muted mt-2">أُنشئ بواسطة <?php echo erp_e($creator); ?> في <?php echo erp_e(get_date_from_gmt(substr($e['created_at'], 0, 19), 'Y/m/d H:i')); ?></div>
<div class="signatures"><div>المحاسب<span>التوقيع</span></div><div>رئيس الحسابات<span>التوقيع</span></div><div>المدير المالي<span>اعتماد</span></div></div>
</div></div>
