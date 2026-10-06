<?php
declare(strict_types=1);
// Document root/circle -> sibling private directory OUTSIDE document root.
$configPath = dirname(__DIR__, 2) . '/private-circle/config.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: SAMEORIGIN');
if (!is_file($configPath)) { http_response_code(503); exit('설정이 아직 완료되지 않았습니다. 설치 가이드를 확인해 주세요.'); }
ini_set('display_errors', '0');
$cfg = require $configPath;
if (($cfg['rate_secret'] ?? '') === 'CHANGE_ME_RANDOM_64_HEX' || strlen($cfg['rate_secret'] ?? '') < 32) { http_response_code(503); exit('서버 보안 설정이 필요합니다.'); }
session_name('circle_session');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['path' => $cfg['base_path'].'/', 'secure' => $cfg['secure_cookies'], 'httponly' => true, 'samesite' => 'Lax']);
$sessionDir=dirname($configPath).'/sessions';
if(!is_dir($sessionDir)&&!mkdir($sessionDir,0700,true)){http_response_code(503);exit('세션 저장 폴더를 확인해 주세요.');}
session_save_path($sessionDir);
if(!session_start()){http_response_code(503);exit('세션을 시작하지 못했습니다.');}
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
function db(): PDO {
 global $cfg;
 static $pdo;
 return $pdo ??= new PDO($cfg['dsn'], $cfg['db_user'], $cfg['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
}
function out(array $data, int $status=200): never {
 http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit;
}
function admin(): void { if (empty($_SESSION['admin']) || ($_SESSION['admin_until'] ?? 0) < time()) out(['error'=>'관리자 로그인이 필요합니다.'],401); }
function csrf(): void { if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) out(['error'=>'화면을 새로고침하고 다시 시도해 주세요.'],403); }
function limit(string $kind, int $maximum): void {
 global $cfg;
 $bucket = hash_hmac('sha256', $kind.'|'.($_SERVER['REMOTE_ADDR'] ?? 'unknown').'|'.date('Y-m-d-H'), $cfg['rate_secret']);
 $p=db(); $p->prepare('INSERT INTO circle_limits(bucket,expires_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 2 HOUR)) ON DUPLICATE KEY UPDATE attempts=attempts+1')->execute([$bucket]);
 $s=$p->prepare('SELECT attempts FROM circle_limits WHERE bucket=?'); $s->execute([$bucket]);
 if ((int)$s->fetchColumn()>$maximum) out(['error'=>'요청이 많습니다. 잠시 후 다시 시도해 주세요.'],429);
 $p->exec('DELETE FROM circle_limits WHERE expires_at < NOW() LIMIT 100');
}
