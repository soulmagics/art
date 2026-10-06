<?php
declare(strict_types=1);
// CI-only fixture. Uses ephemeral MySQL service with test credentials.
$root=sys_get_temp_dir().'/circle-test-'.bin2hex(random_bytes(4));mkdir($root);mkdir($root.'/public_html');mkdir($root.'/private-circle');mkdir($root.'/private-circle/storage');
function copyDir($from,$to){mkdir($to);foreach(scandir($from) as $name){if($name==='.'||$name==='..')continue;$src=$from.'/'.$name;$dst=$to.'/'.$name;if(is_dir($src))copyDir($src,$dst);else copy($src,$dst);}}
copyDir(__DIR__.'/../circle',$root.'/public_html/circle');
$dsn=getenv('CIRCLE_TEST_DSN')?:'mysql:host=127.0.0.1;port=3306;dbname=circle_test;charset=utf8mb4';
$p=new PDO($dsn,'root','test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$p->exec('DROP TABLE IF EXISTS circle_posts');$p->exec('DROP TABLE IF EXISTS circle_limits');$p->exec(file_get_contents(__DIR__.'/../database/001_initial.sql'));
$c=['dsn'=>$dsn,'db_user'=>'root','db_password'=>'test-only','admin_password_hash'=>password_hash('test-admin-password',PASSWORD_DEFAULT),'rate_secret'=>str_repeat('a',64),'storage'=>$root.'/private-circle/storage','base_path'=>'/circle','secure_cookies'=>false,'kakao_js_key'=>''];
file_put_contents($root.'/private-circle/config.php','<?php return '.var_export($c,true).';');
$port=18963;$proc=proc_open([PHP_BINARY,'-S','127.0.0.1:'.$port,'-t',$root.'/public_html'],[['pipe','r'],['file',$root.'/server.log','a'],['file',$root.'/server.log','a']],$pipes);
if(!is_resource($proc))throw new RuntimeException('Server failed');
$cookie='';
function req($action,$method='GET',$body='',array $headers=[]):array {
 global $cookie,$port;
 $headers[]='Cookie: '.$cookie;
 $ctx=stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$body,'ignore_errors'=>true,'timeout'=>10]]);
 $result=file_get_contents('http://127.0.0.1:'.$port.'/circle/api.php?action='.$action,false,$ctx);
 foreach($http_response_header as $h){if(preg_match('/^Set-Cookie:\s*([^;]+)/i',$h,$m))$cookie=$m[1];}
 preg_match('/\s(\d{3})\s/',$http_response_header[0],$m);return [(int)$m[1],$result,$http_response_header];
}
function check($ok,$message):void {if(!$ok)throw new RuntimeException($message);}
function jsonReq($action,$data,$csrf){return req($action,'POST',json_encode($data),['Content-Type: application/json','X-CSRF-Token: '.$csrf]);}
try {
 for($i=0;$i<30;$i++){if(@fsockopen('127.0.0.1',$port))break;usleep(100000);}
 [$code,$body]=req('session');check($code===200,'Session');check(json_decode($body,true)!==null,'Invalid session JSON: '.$body);$csrf=json_decode($body,true)['csrf'];
 [$code]=req('pending');check($code===401,'Pending requires admin');
 [$code]=jsonReq('login',['password'=>'test-admin-password'],'bad');check($code===403,'CSRF enforced');
 // JPEG with APP1 EXIF sentinel. Public re-encoding must remove this segment.
 $im=imagecreatetruecolor(30,20);ob_start();imagejpeg($im);$jpeg=ob_get_clean();imagedestroy($im);
 $meta="Exif\0\0GPS_PRIVATE_SENTINEL";$jpeg=substr($jpeg,0,2)."\xff\xe1".pack('n',strlen($meta)+2).$meta.substr($jpeg,2);
 $boundary='CircleTestBoundary';$fields=['request_key'=>str_repeat('b',32),'consent'=>'yes','confirmed'=>'yes','location'=>'서울 테스트','lat'=>'37.56659','lng'=>'126.97843','source'=>'pin','pattern'=>'Other','caption'=>'<script>alert(1)</script>'];
 $multipart='';foreach($fields as $k=>$v)$multipart.="--$boundary\r\nContent-Disposition: form-data; name=\"$k\"\r\n\r\n$v\r\n";
 $multipart.="--$boundary\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"test.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n$jpeg\r\n--$boundary--\r\n";
 [$code,$body]=req('upload','POST',$multipart,['Content-Type: multipart/form-data; boundary='.$boundary,'X-CSRF-Token: '.$csrf]);check($code===201,'Upload: '.$body);$id=json_decode($body,true)['id'];
 [$code,$body]=req('list');check(json_decode($body,true)['total']===0,'Pending excluded');
 [$code]=req('image&id='.$id);check($code===404,'Pending image private');
 [$code]=jsonReq('moderate',['id'=>$id,'status'=>'approved'],$csrf);check($code===401,'Cannot self approve');
 [$code]=jsonReq('login',['password'=>'wrong'],$csrf);check($code===401,'Wrong password');
 [$code]=jsonReq('login',['password'=>'test-admin-password'],$csrf);check($code===200,'Admin login');
 [$code,$body]=req('pending');check(count(json_decode($body,true)['posts'])===1,'Admin pending');
 [$code]=jsonReq('moderate',['id'=>$id,'status'=>'approved'],$csrf);check($code===200,'Approve');
 [$code,$body]=req('list');$list=json_decode($body,true);check($list['total']===1,'Public approved');check(!isset($list['posts'][0]['exact_lat']),'Exact latitude private');check((float)$list['posts'][0]['public_lat']===37.567,'Rounded public coordinate');
 [$code,$image]=req('image&id='.$id);check($code===200 && str_starts_with($image,"\xff\xd8"),'Public JPEG');check(!str_contains($image,'Exif')&&!str_contains($image,'GPS_PRIVATE_SENTINEL'),'EXIF stripped');
 [$code,$body]=req('upload','POST',$multipart,['Content-Type: multipart/form-data; boundary='.$boundary,'X-CSRF-Token: '.$csrf]);check($code===200 && json_decode($body,true)['id']===$id,'Idempotent retry');
 [$code,$body]=req('list&south=91&north=92&west=1&east=2');check($code===422,'Invalid bounds');
 [$code]=jsonReq('moderate',['id'=>$id,'status'=>'hidden'],$csrf);check($code===200,'Hide');
 [$code]=jsonReq('logout',[],$csrf);check($code===200,'Logout');
 [$code,$body]=req('list');check(json_decode($body,true)['total']===0,'Hidden excluded');
 [$code]=req('image&id='.$id);check($code===404,'Hidden image private');
 echo "MySQL integration passed: upload, CSRF, approval, privacy, metadata, idempotency, hide\n";
}finally{proc_terminate($proc);proc_close($proc);}
