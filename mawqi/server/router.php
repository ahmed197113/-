<?php
// للتشغيل المحلي فقط: php -S localhost:8000 router.php  (يقوم مقام .htaccess)
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api/')) { require __DIR__ . '/api.php'; return true; }
if (preg_match('#^/(data|lib)(/|$)#', $path)) { http_response_code(403); return true; }
if ($path !== '/' && is_file(__DIR__ . $path)) return false;
if (is_file(__DIR__ . '/index.html')) { readfile(__DIR__ . '/index.html'); return true; }
http_response_code(404);
return true;
