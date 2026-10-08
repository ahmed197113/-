<?php
/* نبضٌ صغير — المساعد الذكي وقراءة صور التحاليل عبر Gemini
   المفتاح يبقى على السيرفر فقط، ولكل جهاز حد يومي. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$dev = device();
$in = input();
$mode = $in['mode'] ?? 'chat';
if (!in_array($mode, ['chat', 'labs', 'report'], true)) out(['error' => 'bad_mode'], 400);

/* الإبلاغ عن رد من المساعد: يُحفظ للمراجعة في صفحة الإشراف ولا يُرسل لـ Gemini */
if ($mode === 'report') {
  $reasons = ['معلومة طبية خاطئة', 'محتوى غير لائق', 'أخرى'];
  $reason = clean((string)($in['reason'] ?? ''), 40);
  if (!in_array($reason, $reasons, true)) $reason = 'أخرى';
  $answer = clean((string)($in['answer'] ?? ''), 8000, true);
  if ($answer === '') out(['error' => 'empty'], 400);
  if (!bump("air:$dev", 20)) out(['error' => 'rate_limited', 'text' => 'وصلتِ للحد اليومي للبلاغات، جرّبي غداً.'], 429);
  ai_reports_table();
  db()->prepare('INSERT INTO ai_reports (dev, question, answer, reason, note, t) VALUES (?,?,?,?,?,?)')
    ->execute([$dev, clean((string)($in['question'] ?? ''), 2000, true), $answer, $reason, clean((string)($in['note'] ?? ''), 500, true), (int)round(microtime(true) * 1000)]);
  out(['ok' => true]);
}
if (banned($dev)) out(['error' => 'banned'], 403);
$limit = $mode === 'labs' ? (int)$CFG['ai_daily_labs'] : (int)$CFG['ai_daily_chat'];
if (!bump("ip:" . client_ip(), (int)$CFG['ai_daily_ip']) || !bump("$mode:$dev", $limit)) {
  out(['error' => 'rate_limited', 'text' => 'وصلتِ للحد اليومي للمساعد، جرّبي غداً 💗'], 429);
}

$system = RULES;
$ctx = clean((string)($in['context'] ?? ''), 6000, true);
if ($ctx !== '') $system .= "\n\nمعلومات عن المستخدمة وتعليمات الأسلوب:\n" . $ctx;

if ($mode === 'chat') {
  $messages = [];
  foreach (array_slice((array)($in['messages'] ?? []), -12) as $m) {
    $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
    $text = clean((string)($m['content'] ?? ''), 2000, true);
    if ($text === '') continue;
    if ($messages && end($messages)['role'] === $role) { $messages[count($messages) - 1]['content'] .= "\n\n" . $text; continue; }
    $messages[] = ['role' => $role, 'content' => $text];
  }
  while ($messages && $messages[0]['role'] !== 'user') array_shift($messages);
  if (!$messages || end($messages)['role'] !== 'user') out(['error' => 'empty'], 400);
  $maxTokens = 3000;
} else {
  $prompt = clean((string)($in['prompt'] ?? ''), 4000, true);
  if ($prompt === '') out(['error' => 'empty'], 400);
  $content = [];
  if ($mode === 'labs') {
    $img = (string)($in['image'] ?? '');
    $type = (string)($in['image_type'] ?? 'image/jpeg');
    if (!in_array($type, ['image/jpeg', 'image/png', 'image/webp'], true) || $img === '' || strlen($img) > 5_000_000
      || base64_decode($img, true) === false) out(['error' => 'bad_image'], 400);
    $content[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $type, 'data' => $img]];
    $system = 'أنتِ أداة تستخرج قيم التحاليل الطبية من صورة ورقة تحاليل لامرأة حامل، وتعيدين JSON فقط كما هو مطلوب.';
  }
  $content[] = ['type' => 'text', 'text' => $prompt];
  $messages = [['role' => 'user', 'content' => $content]];
  $maxTokens = 3000;
}

$r = llm($system, $messages, $maxTokens);
out(['text' => $r]);
