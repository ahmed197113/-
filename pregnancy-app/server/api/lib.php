<?php
/* نبضٌ صغير — دوال مشتركة للسيرفر */
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Device');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

/* تعليمات ثابتة للمساعد — لا يمكن للتطبيق تغييرها */
const RULES = 'أنتِ "نبض"، رفيقة ذكية داخل تطبيق عربي لمتابعة الحمل والطفل حتى عمر سنتين. '
  . 'تجيبين فقط عن الحمل والولادة والرضاعة وصحة الأم والطفل وتربيته ونفسية الأم؛ وإن سُئلتِ عن غير ذلك فاعتذري بلطف وأعيدي الحديث لموضوع التطبيق. '
  . 'لا تشخّصي ولا تصفي أدوية بجرعات، ووجّهي للطبيب عند الحاجة، وعند أي علامة خطر (نزيف، ألم شديد، صداع مع زغللة، قلة حركة الجنين، نزول ماء، حرارة عالية للرضيع) انصحي بالتوجه للطوارئ فوراً.';

const CFG_FILE = __DIR__ . '/config.php';
if (!is_file(CFG_FILE)) out(['error' => 'not_configured'], 500);
$CFG = require CFG_FILE;

function out(array $data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function db(): PDO {
  static $pdo = null;
  global $CFG;
  if (!$pdo) {
    $pdo = new PDO($CFG['db_dsn'], $CFG['db_user'] ?? null, $CFG['db_pass'] ?? null,
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
  }
  return $pdo;
}

function input(): array {
  $raw = file_get_contents('php://input') ?: '';
  if (strlen($raw) > 6_000_000) out(['error' => 'too_large'], 413);
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

/* معرّف الجهاز: نص عشوائي يولّده التطبيق — لا نخزّن أي بيانات شخصية */
function device(): string {
  $d = $_SERVER['HTTP_X_DEVICE'] ?? '';
  if (!preg_match('/^[a-z0-9]{12,64}$/', $d)) out(['error' => 'bad_device'], 400);
  return $d;
}

function client_ip(): string {
  return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . 'nabd');
}

function banned(string $dev): bool {
  $s = db()->prepare('SELECT 1 FROM bans WHERE dev = ?');
  $s->execute([$dev]);
  return (bool)$s->fetchColumn();
}

/* عدّاد يومي بسيط: يرجع false إذا تجاوز الحد */
function bump(string $key, int $limit): bool {
  $k = $key . ':' . gmdate('Ymd');
  $pdo = db();
  $s = $pdo->prepare('SELECT n FROM usage_log WHERE k = ?');
  $s->execute([$k]);
  $n = $s->fetchColumn();
  if ($n === false) { $pdo->prepare('INSERT INTO usage_log (k, n) VALUES (?, 1)')->execute([$k]); return true; }
  if ((int)$n >= $limit) return false;
  $pdo->prepare('UPDATE usage_log SET n = n + 1 WHERE k = ?')->execute([$k]);
  return true;
}

function clean(string $s, int $max, bool $multiline = false): string {
  $s = strip_tags($s);
  $s = $multiline ? preg_replace(["/[ \t]+/u", "/\n{3,}/u"], [' ', "\n\n"], str_replace("\r", '', $s)) : preg_replace('/\s+/u', ' ', $s);
  return mb_substr(trim($s ?? ''), 0, $max);
}

/* استدعاء نموذج Google Gemini (الخطة المجانية) — يرجع النص أو ينهي الطلب برسالة خطأ مناسبة.
   $messages: [['role' => 'user'|'assistant', 'content' => نص أو [['type'=>'text'|'image', ...]]]] */
function llm(string $system, array $messages, int $maxTokens): string {
  global $CFG;
  $contents = [];
  foreach ($messages as $m) {
    $parts = [];
    foreach (is_array($m['content']) ? $m['content'] : [['type' => 'text', 'text' => $m['content']]] as $c) {
      if ($c['type'] === 'image') $parts[] = ['inline_data' => ['mime_type' => $c['media_type'], 'data' => $c['data']]];
      else $parts[] = ['text' => $c['text']];
    }
    $contents[] = ['role' => $m['role'] === 'assistant' ? 'model' : 'user', 'parts' => $parts];
  }
  $body = [
    'system_instruction' => ['parts' => [['text' => $system]]],
    'contents' => $contents,
    'generationConfig' => ['maxOutputTokens' => $maxTokens],
  ];
  $model = $CFG['model'] ?? 'gemini-flash-latest';
  $base = $CFG['api_base'] ?? 'https://generativelanguage.googleapis.com/v1beta/models/';
  $ch = curl_init($base . rawurlencode($model) . ':generateContent');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 90,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $CFG['gemini_key']],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
  ]);
  $raw = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $res = is_string($raw) ? json_decode($raw, true) : null;
  if ($code !== 200 || !is_array($res)) {
    error_log('nabd ai error ' . $code . ' ' . substr((string)$raw, 0, 500));
    $busy = in_array($code, [429, 503], true);
    out(['error' => $busy ? 'busy' : 'upstream', 'text' => $busy ? 'المساعد مشغول الآن، جرّبي بعد دقيقة.' : 'تعذّر الوصول للمساعد الآن.'], 502);
  }
  $text = '';
  foreach ($res['candidates'][0]['content']['parts'] ?? [] as $part) {
    if (isset($part['text']) && empty($part['thought'])) $text .= $part['text'];
  }
  $text = trim($text);
  if ($text === '') return 'لا أستطيع الإجابة عن هذا السؤال، لكن طبيبك يقدر يساعدك فيه 💗';
  return $text;
}
