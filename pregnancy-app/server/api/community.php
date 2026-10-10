<?php
/* نبضٌ صغير — مجتمع الأمهات: أسئلة وأجوبة مع إبلاغ وحظر وإخفاء تلقائي */
declare(strict_types=1);
require __DIR__ . '/lib.php';

const BLOCK_RE = '/(https?:\/\/|www\.)|(\d[\s-]?){8,}/u';
const HIDE_AT = 3; // يُخفى المحتوى تلقائياً بعد 3 بلاغات

$dev = device();
$in = input();
$act = $in['action'] ?? 'list';
$pdo = db();
$writes = ['add', 'answer', 'helpful', 'report', 'remove', 'remove_answer', 'ai_answer', 'ai_report'];
if (in_array($act, $writes, true) && banned($dev)) out(['error' => 'banned'], 403);

// معرّف مجهول ثابت لصاحب المحتوى، يُستخدم للحظر دون كشف معرّف الجهاز
function au(string $dev): string { return substr(hash('sha256', $dev . '|nabd-author'), 0, 16); }
function qrow(array $r, string $dev): array {
  return ['id' => (string)$r['id'], 'uid' => $r['dev'] === $dev ? 'me' : '', 'au' => au($r['dev']), 'nick' => $r['anon'] ? '' : $r['nick'], 'anon' => (bool)$r['anon'],
    'cat' => $r['cat'], 'title' => $r['title'], 'body' => $r['body'], 'stage' => $r['stage'], 't' => (int)$r['t'], 'ac' => (int)$r['ac']];
}
function arow(array $r, string $dev): array {
  return ['id' => (string)$r['id'], 'uid' => $r['ai'] ? 'ai' : ($r['dev'] === $dev ? 'me' : ''), 'au' => $r['ai'] ? '' : au($r['dev']), 'ai' => (bool)$r['ai'], 'nick' => $r['ai'] ? 'نبض' : ($r['anon'] ? '' : $r['nick']),
    'anon' => (bool)$r['anon'], 'body' => $r['body'], 'stage' => $r['stage'], 't' => (int)$r['t'], 'hp' => (int)$r['hp']];
}
function question(int $id): array {
  $s = db()->prepare('SELECT * FROM questions WHERE id = ? AND hidden = 0');
  $s->execute([$id]);
  $q = $s->fetch();
  if (!$q) out(['error' => 'not_found'], 404);
  return $q;
}
function now_ms(): int { return (int)round(microtime(true) * 1000); }

switch ($act) {
  case 'list':
    $rows = $pdo->query('SELECT * FROM questions WHERE hidden = 0 ORDER BY t DESC LIMIT 300')->fetchAll();
    out(['items' => array_map(fn($r) => qrow($r, $dev), $rows)]);

  case 'add':
    $title = clean((string)($in['title'] ?? ''), 160);
    $body = clean((string)($in['body'] ?? ''), 2000, true);
    if (mb_strlen($title) < 5) out(['error' => 'short'], 400);
    if (preg_match(BLOCK_RE, $title . ' ' . $body)) out(['error' => 'blocked', 'text' => 'ممنوع وضع روابط أو أرقام هواتف'], 400);
    if (!bump("q:$dev", 10)) out(['error' => 'rate_limited'], 429);
    $pdo->prepare('INSERT INTO questions (dev, nick, anon, cat, title, body, stage, t, ip) VALUES (?,?,?,?,?,?,?,?,?)')
      ->execute([$dev, clean((string)($in['nick'] ?? ''), 40), empty($in['anon']) ? 0 : 1, preg_replace('/[^a-z0-9]/', '', (string)($in['cat'] ?? 'other')) ?: 'other',
        $title, $body, clean((string)($in['stage'] ?? ''), 80), now_ms(), client_ip()]);
    out(['id' => (string)$pdo->lastInsertId()]);

  case 'answers':
    $qid = (int)($in['qid'] ?? 0);
    $s = $pdo->prepare('SELECT * FROM answers WHERE qid = ? AND hidden = 0 ORDER BY t ASC LIMIT 300');
    $s->execute([$qid]);
    out(['items' => array_map(fn($r) => arow($r, $dev), $s->fetchAll())]);

  case 'answer':
    $q = question((int)($in['qid'] ?? 0));
    $body = clean((string)($in['body'] ?? ''), 1000, true);
    if (mb_strlen($body) < 2) out(['error' => 'short'], 400);
    if (preg_match(BLOCK_RE, $body)) out(['error' => 'blocked', 'text' => 'ممنوع وضع روابط أو أرقام هواتف'], 400);
    if (!bump("a:$dev", 40)) out(['error' => 'rate_limited'], 429);
    $pdo->prepare('INSERT INTO answers (qid, dev, nick, anon, ai, body, stage, t, ip) VALUES (?,?,?,?,0,?,?,?,?)')
      ->execute([$q['id'], $dev, clean((string)($in['nick'] ?? ''), 40), empty($in['anon']) ? 0 : 1, $body, clean((string)($in['stage'] ?? ''), 80), now_ms(), client_ip()]);
    $pdo->prepare('UPDATE questions SET ac = ac + 1 WHERE id = ?')->execute([$q['id']]);
    out(['ok' => true]);

  case 'ai_answer':
    $q = question((int)($in['qid'] ?? 0));
    $s = $pdo->prepare('SELECT 1 FROM answers WHERE qid = ? AND ai = 1');
    $s->execute([$q['id']]);
    if ($s->fetchColumn()) out(['ok' => true]); // رد واحد لنبض لكل سؤال
    if (!bump("ai:$dev", (int)$CFG['ai_daily_chat']) || !bump('ip:' . client_ip(), (int)$CFG['ai_daily_ip'])) out(['error' => 'rate_limited'], 429);
    $text = llm(RULES, [['role' => 'user', 'content' => "هذا سؤال نشرته أم في مجتمع التطبيق ({$q['stage']}):\nالعنوان: {$q['title']}\nالتفاصيل: {$q['body']}\n\nاكتبي رداً مختصراً ومفيداً لها ولكل من يقرأ، في 4–7 نقاط."]], 2000);
    if ($text === '') out(['error' => 'empty'], 502);
    $pdo->prepare('INSERT INTO answers (qid, dev, nick, anon, ai, body, stage, t, ip) VALUES (?,?,?,0,1,?,?,?,?)')
      ->execute([$q['id'], 'ai', 'نبض', $text, '', now_ms(), '']);
    $pdo->prepare('UPDATE questions SET ac = ac + 1 WHERE id = ?')->execute([$q['id']]);
    out(['ok' => true]);

  case 'helpful':
    $aid = (int)($in['aid'] ?? 0);
    if (bump("hp:$aid:$dev", 1)) $pdo->prepare('UPDATE answers SET hp = hp + 1 WHERE id = ?')->execute([$aid]);
    out(['ok' => true]);

  case 'report':
    // ref: "q:ID" أو "a:QID/AID"
    $ref = (string)($in['ref'] ?? '');
    if (!preg_match('/^(q:\d+|a:\d+\/\d+)$/', $ref)) out(['error' => 'bad_ref'], 400);
    try { $pdo->prepare('INSERT INTO reports (ref, dev, t) VALUES (?,?,?)')->execute([$ref, $dev, now_ms()]); }
    catch (PDOException $e) { out(['ok' => true]); } // بلاغ مكرر
    [$table, $id] = $ref[0] === 'q' ? ['questions', (int)substr($ref, 2)] : ['answers', (int)explode('/', $ref)[1]];
    $pdo->prepare("UPDATE $table SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= " . HIDE_AT . " THEN 1 ELSE hidden END WHERE id = ?")->execute([$id]);
    out(['ok' => true]);

  case 'ai_report':
    $text = clean((string)($in['text'] ?? ''), 2000, true);
    if ($text === '' || !bump("air:$dev", 20)) out(['ok' => true]);
    $pdo->prepare('INSERT INTO ai_reports (dev, text, t) VALUES (?,?,?)')->execute([$dev, $text, now_ms()]);
    out(['ok' => true]);

  case 'remove_answer':
    $s = $pdo->prepare('DELETE FROM answers WHERE id = ? AND qid = ? AND dev = ? AND ai = 0');
    $s->execute([(int)($in['aid'] ?? 0), (int)($in['qid'] ?? 0), $dev]);
    if ($s->rowCount()) $pdo->prepare('UPDATE questions SET ac = CASE WHEN ac > 0 THEN ac - 1 ELSE 0 END WHERE id = ?')->execute([(int)($in['qid'] ?? 0)]);
    out(['ok' => (bool)$s->rowCount()]);

  case 'remove':
    $qid = (int)($in['qid'] ?? 0);
    $s = $pdo->prepare('DELETE FROM questions WHERE id = ? AND dev = ?');
    $s->execute([$qid, $dev]);
    if ($s->rowCount()) $pdo->prepare('DELETE FROM answers WHERE qid = ?')->execute([$qid]);
    out(['ok' => (bool)$s->rowCount()]);
}
out(['error' => 'bad_action'], 400);
