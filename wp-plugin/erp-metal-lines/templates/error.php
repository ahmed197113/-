<?php defined('ABSPATH') || exit; ?>
<div class="card" style="max-width:640px;margin:3rem auto"><div class="card-body text-center py-5">
<i class="bi <?php echo $status === 404 ? 'bi-signpost-split' : ($status === 403 ? 'bi-shield-lock' : 'bi-exclamation-octagon'); ?>" style="font-size:3rem;color:#14325a"></i>
<h4 class="mt-3"><?php echo erp_e($message); ?></h4>
<a href="<?php echo esc_url(home_url('/')); ?>" class="btn btn-primary mt-3"><i class="bi bi-house"></i> لوحة التحكم</a>
</div></div>
<?php
