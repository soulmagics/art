<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR,"관리자 비밀번호를 입력하세요 (입력은 터미널에 표시될 수 있습니다): ");
$password=trim(fgets(STDIN));
if(strlen($password)<12) {fwrite(STDERR,"12자 이상을 사용하세요.\n");exit(1);}
echo password_hash($password,PASSWORD_DEFAULT).PHP_EOL;
