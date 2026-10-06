<?php
/** التخطيط الأساسي — نسخة من templates/base.html في الأصل. */
defined('ABSPATH') || exit;
$company = ERP_Company::get();
$user = wp_get_current_user();
$A = [ERP_Templates::class, 'active'];
$nav = function (string $href, string $icon, string $label, string $cap = 'erp_access', ...$prefixes) use ($A) {
    if (!current_user_can($cap)) {
        return '';
    }
    $cls = $prefixes ? $A(...$prefixes) : $A($href);
    return '<a href="' . esc_url(home_url($href)) . '" class="' . esc_attr($cls) . '"><i class="bi ' . esc_attr($icon) . '"></i> '
        . esc_html($label) . '</a>';
};
$type = ERP_UI::get('type');
?><!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?php echo erp_e(($title ?? 'النظام المحاسبي') . ' | ' . $company['name']); ?></title>
<link rel="stylesheet" href="<?php echo esc_url(ERP_Templates::asset('vendor/bootstrap.rtl.min.css')); ?>">
<link rel="stylesheet" href="<?php echo esc_url(ERP_Templates::asset('vendor/bootstrap-icons.min.css')); ?>">
<link rel="stylesheet" href="<?php echo esc_url(ERP_Templates::asset('vendor/tom-select.bootstrap5.min.css')); ?>">
<link rel="stylesheet" href="<?php echo esc_url(ERP_Templates::asset('css/app.css')); ?>">
<script src="<?php echo esc_url(ERP_Templates::asset('vendor/bootstrap.bundle.min.js')); ?>"></script>
<script src="<?php echo esc_url(ERP_Templates::asset('vendor/tom-select.complete.min.js')); ?>"></script>
<script src="<?php echo esc_url(ERP_Templates::asset('js/app.js')); ?>"></script>
</head>
<body>
<nav class="sidebar">
  <div class="brand"><i class="bi bi-buildings"></i> <?php echo erp_e($company['name']); ?><small>نظام المحاسبة والمقاولات المتكامل</small></div>
  <?php echo $nav('/', 'bi-speedometer2', 'لوحة التحكم'); // phpcs:ignore ?>

  <div class="section">العملاء والموردون</div>
  <a href="<?php echo esc_url(erp_url('/partners/', ['type' => 'customer'])); ?>" class="<?php echo $type === 'customer' ? 'active' : ''; ?>"><i class="bi bi-people"></i> العملاء</a>
  <a href="<?php echo esc_url(erp_url('/partners/', ['type' => 'supplier'])); ?>" class="<?php echo $type === 'supplier' ? 'active' : ''; ?>"><i class="bi bi-truck"></i> الموردون</a>
  <a href="<?php echo esc_url(erp_url('/partners/', ['type' => 'subcontractor'])); ?>" class="<?php echo $type === 'subcontractor' ? 'active' : ''; ?>"><i class="bi bi-person-badge"></i> مقاولو الباطن</a>

  <div class="section">المحاسبة العامة</div>
  <a href="<?php echo esc_url(home_url('/journal/')); ?>" class="<?php echo in_array(ERP_Router::path(), ['/journal/', '/journal/new/'], true) ? 'active' : ''; ?>"><i class="bi bi-journal-text"></i> قيود اليومية</a>
  <?php echo $nav('/journal/templates/', 'bi-lightning-charge', 'القيود الجاهزة'); // phpcs:ignore ?>
  <?php echo $nav('/accounts/', 'bi-diagram-3', 'شجرة الحسابات'); // phpcs:ignore ?>
  <?php echo $nav('/cost-centers/', 'bi-bullseye', 'مراكز التكلفة'); // phpcs:ignore ?>

  <div class="section">التقارير والإعدادات</div>
  <?php echo $nav('/reports/', 'bi-graph-up-arrow', 'التقارير المالية', 'erp_view_reports'); // phpcs:ignore ?>
  <?php echo $nav('/settings/', 'bi-gear', 'الإعدادات', 'erp_manage_settings', '/settings/', '/taxes/'); // phpcs:ignore ?>
  <?php if (current_user_can('erp_admin')) : ?>
    <a href="<?php echo esc_url(home_url('/settings/system/')); ?>" class="<?php echo erp_a($A('/settings/system/', '/settings/audit/')); ?>"><i class="bi bi-shield-lock"></i> إدارة النظام وسجل التدقيق</a>
  <?php endif; ?>
  <?php if (current_user_can('list_users')) : ?>
    <a href="<?php echo esc_url(admin_url('users.php')); ?>"><i class="bi bi-people-fill"></i> المستخدمون والصلاحيات</a>
  <?php endif; ?>
  <div style="height:2rem"></div>
</nav>

<div class="main">
  <div class="topbar d-flex align-items-center gap-2">
    <button class="btn btn-sm btn-outline-secondary d-lg-none" id="sidebarToggle" type="button"><i class="bi bi-list"></i></button>
    <div class="d-none d-md-flex gap-1">
      <?php if (current_user_can('erp_edit_entries')) : ?>
        <a class="btn btn-sm btn-primary" href="<?php echo esc_url(home_url('/journal/new/')); ?>"><i class="bi bi-plus-lg"></i> قيد يومية</a>
        <a class="btn btn-sm btn-outline-warning" href="<?php echo esc_url(home_url('/journal/templates/')); ?>"><i class="bi bi-lightning-charge"></i> قيد جاهز</a>
      <?php endif; ?>
    </div>
    <div class="ms-auto d-flex align-items-center gap-2">
      <span class="text-muted small"><i class="bi bi-person-circle"></i> <?php echo erp_e($user->display_name ?: $user->user_login); ?></span>
      <a class="btn btn-sm btn-light" href="<?php echo esc_url(wp_logout_url(home_url('/'))); ?>"><i class="bi bi-box-arrow-left"></i> خروج</a>
    </div>
  </div>
  <div class="content">
    <div class="print-header"><h4><?php echo erp_e($company['name']); ?></h4><div><?php echo erp_e($company['address']); ?><?php if ($company['tax_id']) : ?> | رقم التسجيل الضريبي: <?php echo erp_e($company['tax_id']); ?><?php endif; ?></div></div>
    <?php foreach (ERP_UI::take_flash() as [$level, $msg]) : ?>
      <div class="alert alert-<?php echo erp_a($level); ?> alert-dismissible fade show py-2"><?php echo erp_e($msg); ?><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>
    <?php endforeach; ?>
    <?php echo $content; // phpcs:ignore — محتوى القالب مُهرَّب داخله ?>
  </div>
</div>
</body>
</html>
