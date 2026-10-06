<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$errors=[];
if(version_compare(PHP_VERSION,'8.2','<'))$errors[]='PHP 8.2 이상 필요';
foreach(['pdo_mysql','gd','fileinfo','session'] as $ext)if(!extension_loaded($ext))$errors[]=$ext.' 확장 필요';
$config=$argv[1]??'';
if(!$config||!is_file($config))$errors[]='설정 파일 경로 필요';
else {
 $c=require $config;
 if(($c['base_path']??'')!=='/circle')$errors[]='base_path는 /circle';
 if(strlen($c['rate_secret']??'')<32||str_starts_with($c['rate_secret']??'','CHANGE_ME'))$errors[]='rate_secret 설정 필요';
 if(!password_get_info($c['admin_password_hash']??'')['algo'])$errors[]='비밀번호 hash 설정 필요';
 if(empty($c['secure_cookies']))$errors[]='운영에는 secure_cookies=true 필요';
 try{$p=new PDO($c['dsn'],$c['db_user'],$c['db_password']);$p->query('SELECT request_key FROM circle_posts LIMIT 1');$p->query('SELECT bucket FROM circle_limits LIMIT 1');}catch(Throwable $e){$errors[]='DB 연결/스키마 확인 실패 (비밀정보 보호를 위해 상세 출력 생략)';}
 if(!is_dir($c['storage'])||!is_writable($c['storage']))$errors[]='사진 저장 폴더가 쓰기 가능해야 함';
}
foreach($errors as $e)fwrite(STDERR,$e.PHP_EOL);
if($errors)exit(1);
echo "서버 사전 점검 통과. 브라우저 실기기 검증은 별도로 필요합니다.\n";
