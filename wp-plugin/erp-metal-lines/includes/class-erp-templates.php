<?php
/** محرك القوالب: قوالب PHP في templates/ تُعرض داخل التخطيط الأساسي (نسخة من base.html). */
defined('ABSPATH') || exit;

final class ERP_Templates
{
    /** يعرض قالباً ويرجع HTML كنص. */
    public static function render(string $name, array $vars = []): string
    {
        $file = ERP_PLUGIN_DIR . 'templates/' . $name . '.php';
        if (!preg_match('#^[a-z0-9_/]+$#', $name) || !file_exists($file)) {
            throw new RuntimeException('Template not found: ' . $name);
        }
        extract($vars, EXTR_SKIP);
        ob_start();
        try {
            include $file;
        } catch (Throwable $e) {
            ob_end_clean();
            throw $e;
        }
        return (string) ob_get_clean();
    }

    /** صفحة كاملة: القالب داخل التخطيط الأساسي. */
    public static function page(string $name, array $vars = []): string
    {
        $vars['content'] = self::render($name, $vars);
        return self::render('layout', $vars);
    }

    public static function asset(string $path): string
    {
        return ERP_PLUGIN_URL . 'static/' . ltrim($path, '/') . '?v=' . ERP_VERSION;
    }

    /** class="active" للرابط الحالي (مثل وسم active في الأصل). */
    public static function active(string ...$prefixes): string
    {
        $p = ERP_Router::path();
        foreach ($prefixes as $pre) {
            if ($pre === '/' ? $p === '/' : strpos($p, $pre) === 0) {
                return 'active';
            }
        }
        return '';
    }
}
