<?php
namespace Mawqi;

const SESSION_DAYS = 30;
const ROLES = [
  'admin' => 'مدير عام',
  'project_manager' => 'مدير مشروع',
  'supervisor' => 'مشرف موقع',
  'accountant' => 'محاسب',
];

function publicUser(array $u): array {
  return ['id' => (int)$u['id'], 'name' => $u['name'], 'username' => $u['username'], 'role' => $u['role'], 'roleLabel' => ROLES[$u['role']]];
}

function needsSetup(): bool { return (int)scalar('SELECT COUNT(*) FROM users') === 0; }

function newSession(array $u): array {
  $token = bin2hex(random_bytes(24));
  q('DELETE FROM sessions WHERE expires_at < ?', [time()]);
  q('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [$token, $u['id'], time() + SESSION_DAYS * 86400]);
  return ['token' => $token, 'user' => publicUser($u)];
}

function login(string $username, string $password): array {
  $u = one('SELECT * FROM users WHERE username = ? AND active = 1', [trim($username)]);
  if (!$u || !password_verify($password, $u['password_hash'])) fail(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  return newSession($u);
}

function bearerToken(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if ($h === '' && function_exists('getallheaders')) foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
  return str_starts_with($h, 'Bearer ') ? substr($h, 7) : null;
}

function currentUser(): array {
  $token = bearerToken();
  if (!$token) fail(401, 'يجب تسجيل الدخول');
  $u = one('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.active = 1', [$token, time()]);
  if (!$u) fail(401, 'انتهت الجلسة، سجّل الدخول من جديد');
  return $u;
}

/** IDs of the projects a user may see; null means all projects. */
function projectScope(array $u): ?array {
  if ($u['role'] === 'admin' || $u['role'] === 'accountant') return null;
  $col = $u['role'] === 'project_manager' ? 'manager_id' : 'supervisor_id';
  return array_map('intval', array_column(all("SELECT id FROM projects WHERE $col = ?", [$u['id']]), 'id'));
}

function inList(string $col, ?array $ids): string {
  if ($ids === null) return '1=1';
  return $ids ? "$col IN (" . implode(',', array_map('intval', $ids)) . ')' : '0=1';
}
