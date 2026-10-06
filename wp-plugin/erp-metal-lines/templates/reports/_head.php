<?php defined('ABSPATH') || exit; ?>
<div class="d-flex flex-wrap align-items-center gap-2 mb-3"><h1 class="page-title"><i class="bi bi-graph-up-arrow"></i> <?php echo erp_e($title); ?></h1>
<div class="ms-auto d-flex gap-2 no-print"><button type="button" class="btn btn-sm btn-outline-success" onclick="exportTable(this,'<?php echo erp_a($title); ?>')"><i class="bi bi-file-earmark-excel"></i> Excel</button><button type="button" class="btn btn-sm btn-dark" onclick="print()"><i class="bi bi-printer"></i> طباعة</button></div></div>
<div class="small mb-2 d-none d-print-block"><?php if (!empty($date_from)) : ?>من <?php echo erp_e(erp_date($date_from)); ?> <?php endif; ?>حتى <?php echo erp_e(erp_date($date_to ?? '')); ?></div>
