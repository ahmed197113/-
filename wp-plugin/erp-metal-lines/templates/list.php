<?php
/** القائمة العامة — نسخة من generic/list.html. المتغيرات: title, icon, columns, rows, page, pages, total_rows, q, has_search, filters, new_url, buttons, totals */
defined('ABSPATH') || exit;
$keep = array_intersect_key($_GET, array_flip(['kind', 'type'])); // phpcs:ignore
?>
<div class="d-flex flex-wrap align-items-center gap-2 mb-3">
  <h1 class="page-title"><i class="bi <?php echo erp_a($icon); ?>"></i> <?php echo erp_e($title); ?></h1>
  <div class="ms-auto d-flex gap-2">
    <?php foreach ($buttons ?? [] as [$url, $label, $ic, $color]) : ?><a href="<?php echo esc_url($url); ?>" class="btn btn-sm btn-<?php echo erp_a($color); ?>"><i class="bi <?php echo erp_a($ic); ?>"></i> <?php echo erp_e($label); ?></a><?php endforeach; ?>
    <button type="button" class="btn btn-sm btn-outline-success" onclick="exportTable(this,'<?php echo erp_a($title); ?>')"><i class="bi bi-file-earmark-excel"></i> Excel</button>
    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="window.print()"><i class="bi bi-printer"></i></button>
    <?php if (!empty($new_url)) : ?><a href="<?php echo esc_url($new_url); ?>" class="btn btn-sm btn-primary"><i class="bi bi-plus-lg"></i> جديد</a><?php endif; ?>
  </div>
</div>
<?php if (!empty($has_search) || !empty($filters)) : ?>
<form class="filters row g-2 mb-3" method="get">
  <?php foreach ($keep as $k => $v) : ?><input type="hidden" name="<?php echo erp_a($k); ?>" value="<?php echo erp_a(sanitize_text_field(wp_unslash($v))); ?>"><?php endforeach; ?>
  <?php if (!empty($has_search)) : ?><div class="col-md-4"><input class="form-control form-control-sm" name="q" value="<?php echo erp_a($q); ?>" placeholder="بحث..."></div><?php endif; ?>
  <?php foreach ($filters ?? [] as $f) : ?><div class="col-md-2"><select name="<?php echo erp_a($f['name']); ?>" class="form-select form-select-sm" onchange="this.form.submit()"><option value=""><?php echo erp_e($f['title']); ?>: الكل</option><?php foreach ($f['choices'] as $val => $lbl) : ?><option value="<?php echo erp_a($val); ?>" <?php selected((string) $f['value'], (string) $val); ?>><?php echo erp_e($lbl); ?></option><?php endforeach; ?></select></div><?php endforeach; ?>
  <div class="col-auto"><button class="btn btn-sm btn-secondary"><i class="bi bi-search"></i> بحث</button></div>
</form>
<?php endif; ?>
<div class="card"><div class="table-responsive">
<table class="table table-hover table-sm align-middle exportable">
  <thead><tr><?php foreach ($columns as [$ct, $num]) : ?><th class="<?php echo $num ? 'num' : ''; ?>"><?php echo erp_e($ct); ?></th><?php endforeach; ?></tr></thead>
  <tbody>
  <?php if (!$rows) : ?><tr><td colspan="<?php echo count($columns); ?>" class="text-center text-muted py-4">لا توجد بيانات</td></tr><?php endif; ?>
  <?php foreach ($rows as $r) : ?>
    <tr<?php if ($r['url']) : ?> class="clickable" data-href="<?php echo esc_url($r['url']); ?>"<?php endif; ?>>
      <?php foreach ($r['cells'] as $i => $cell) : ?><td class="<?php echo $columns[$i][1] ? 'num' : ''; ?>"><?php echo $cell; // phpcs:ignore — مُهرَّب في الدالة المولدة ?></td><?php endforeach; ?>
    </tr>
  <?php endforeach; ?>
  </tbody>
  <?php if (!empty($totals)) : ?><tfoot><tr><?php foreach ($totals as $i => $t) : ?><td class="num"><?php echo ($i === 0 && $t === '') ? 'الإجمالي' : erp_e($t); ?></td><?php endforeach; ?></tr></tfoot><?php endif; ?>
</table></div></div>
<?php if ($pages > 1) :
    $base = $_GET; // phpcs:ignore
    unset($base['page']);
    $mk = function ($p) use ($base) {
        return esc_url(add_query_arg(array_map(function ($v) { return rawurlencode(sanitize_text_field(wp_unslash($v))); }, $base) + ['page' => $p]));
    }; ?>
<nav class="mt-3"><ul class="pagination pagination-sm">
  <?php if ($page > 1) : ?><li class="page-item"><a class="page-link" href="<?php echo $mk($page - 1); // phpcs:ignore ?>">السابق</a></li><?php endif; ?>
  <li class="page-item disabled"><span class="page-link">صفحة <?php echo (int) $page; ?> من <?php echo (int) $pages; ?></span></li>
  <?php if ($page < $pages) : ?><li class="page-item"><a class="page-link" href="<?php echo $mk($page + 1); // phpcs:ignore ?>">التالي</a></li><?php endif; ?>
</ul></nav>
<?php endif;
