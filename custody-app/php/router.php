<?php
// موجّه خادم PHP المدمج للتجربة المحلية — يحاكي .htaccess
// التشغيل من المجلد الذي يجمع public/ و php/: php -S localhost:8080 router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if (preg_match('#/api/#', $path)) { require __DIR__ . '/api.php'; return true; }
if (preg_match('#^/(data(/|$)|core\.php|router\.php|README\.md|\.)#', $path)) { http_response_code(403); return true; }
$file = realpath(__DIR__ . urldecode($path));
if ($path !== '/' && $file && str_starts_with($file, __DIR__ . '/') && is_file($file)) {
  if (str_ends_with($file, '.webmanifest')) { header('Content-Type: application/manifest+json'); readfile($file); return true; }
  return false;
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
readfile(__DIR__ . '/index.html');
return true;
