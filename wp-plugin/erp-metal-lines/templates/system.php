<?php defined('ABSPATH') || exit; ?>
<h1 class="page-title mb-3"><i class="bi bi-shield-lock"></i> إدارة النظام</h1>
<div class="row g-3">
<div class="col-lg-4"><div class="card h-100"><div class="card-header"><i class="bi bi-magic"></i> تهيئة النظام (setup_company)</div><div class="card-body small">
<p>ينشئ شجرة الحسابات المصرية (113 حساب) والتوجيه المحاسبي والضرائب و17 قيداً جاهزاً والمخزن الرئيسي. آمن للتكرار: لا يكرر ما هو موجود.</p>
<p class="mb-1">الحسابات الحالية: <b><?php echo (int) $accounts; ?></b> — القيود: <b><?php echo (int) $entries; ?></b></p>
<form method="post"><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?><input type="hidden" name="op" value="setup"><button class="btn btn-primary btn-sm mt-2"><i class="bi bi-play-fill"></i> تشغيل التهيئة</button></form></div></div></div>
<div class="col-lg-4"><div class="card h-100" style="border-color:#e0a1a1"><div class="card-header text-danger"><i class="bi bi-trash3"></i> مسح البيانات (reset_data)</div><div class="card-body small">
<p>يمسح كل الحركات والقيود والعملاء والموردين والمشروعات، ويبقي على: بيانات الشركة، شجرة الحسابات، التوجيه المحاسبي، الضرائب، القيود الجاهزة، المخزن الرئيسي، المستخدمين، وسجل التدقيق.</p>
<form method="post"><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?><input type="hidden" name="op" value="reset">
<label class="form-label small" for="id_confirm">للتأكيد اكتب «نعم»</label><input class="form-control form-control-sm mb-2" name="confirm" id="id_confirm" autocomplete="off">
<button class="btn btn-outline-danger btn-sm"><i class="bi bi-trash3"></i> مسح نهائي</button></form></div></div></div>
<div class="col-lg-4"><div class="card h-100"><div class="card-header"><i class="bi bi-cloud-arrow-up"></i> الاسترجاع / نقل البيانات من نسخة Django</div><div class="card-body small">
<p>يقبل ملف النسخة الاحتياطية من الإضافة أو ملف «تنزيل نسخة احتياطية» من برنامج Django. الاسترجاع على قاعدة فارغة فقط، داخل معاملة واحدة، مع فحص كل المراجع.</p>
<p>حالة القاعدة: <?php echo $empty ? '<span class="badge text-bg-success">فارغة — جاهزة للاسترجاع</span>' : '<span class="badge text-bg-warning">بها بيانات — امسحها أولاً</span>'; ?></p>
<form method="post" enctype="multipart/form-data"><?php echo ERP_UI::nonce_field(); // phpcs:ignore ?><input type="hidden" name="op" value="restore">
<input type="file" class="form-control form-control-sm mb-2" name="backup_file" accept=".json,application/json"><button class="btn btn-success btn-sm" <?php disabled(!$empty); ?>><i class="bi bi-upload"></i> استرجاع</button></form>
<hr><a href="<?php echo esc_url(home_url('/settings/backup/')); ?>" class="btn btn-outline-primary btn-sm"><i class="bi bi-cloud-download"></i> تنزيل نسخة احتياطية الآن</a></div></div></div>
</div>
<div class="mt-3 d-flex gap-2"><a href="<?php echo esc_url(home_url('/settings/audit/')); ?>" class="btn btn-sm btn-outline-dark"><i class="bi bi-shield-check"></i> سجل التدقيق</a>
<span class="small text-muted align-self-center">أخطاء مسجلة داخلياً: <?php echo (int) $errors_count; ?></span></div>
