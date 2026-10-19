<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
require __DIR__.'/validation.php';
require __DIR__.'/images.php';
require __DIR__.'/google-auth.php';
require __DIR__.'/collection.php';
function jsonInput(): array {
 $input=json_decode(file_get_contents('php://input'),true);
 if(!is_array($input))throw new InvalidArgumentException('요청 내용을 확인해 주세요.');
 return $input;
}
try {
 $action = $_GET['action'] ?? 'list';
 if ($_SERVER['REQUEST_METHOD']==='GET') {
  if ($action==='session') {
   $_SESSION['google_nonce'] ??= bin2hex(random_bytes(24));
   $user=null;
   if(!empty($_SESSION['user_id'])&&($_SESSION['user_until']??0)>time()){
    $s=db()->prepare('SELECT id,display_name,email FROM circle_users WHERE id=?');$s->execute([$_SESSION['user_id']]);$user=$s->fetch()?:null;
   }
   out(['csrf'=>$_SESSION['csrf'],'google_nonce'=>$_SESSION['google_nonce'],'user'=>$user,'admin'=>!empty($_SESSION['admin'])&&($_SESSION['admin_until']??0)>time()]);
  }
  if ($action==='image') {
   $id=$_GET['id']??''; if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/',$id)) out(['error'=>'사진을 찾을 수 없습니다.'],404);
   $s=db()->prepare('SELECT post_type,status,user_id,image_name,thumb_name FROM circle_posts WHERE id=?');$s->execute([$id]);$row=$s->fetch();
   $isAdmin=!empty($_SESSION['admin'])&&($_SESSION['admin_until']??0)>time();
   $isOwner=$row&&$row['user_id']!==null&&$row['user_id']===($_SESSION['user_id']??null)&&($_SESSION['user_until']??0)>time();
   if (!$row || $row['post_type']!=='photo' || ($row['status']!=='approved'&&!$isAdmin&&!$isOwner)) out(['error'=>'사진을 찾을 수 없습니다.'],404);
   $name=($_GET['thumb']??'')==='1'?$row['thumb_name']:$row['image_name'];$path=$cfg['storage'].'/'.basename($name);
   if (!is_file($path)) out(['error'=>'사진 파일이 없습니다.'],404);
   header('Content-Type: image/jpeg');header('Cache-Control: private, no-store');session_write_close();readfile($path);exit;
  }
  if ($action==='pending' || $action==='manage') {
   admin();$status=$action==='pending'?'pending':($_GET['status']??'pending');
   if(!in_array($status,['pending','approved','hidden','rejected'],true))throw new InvalidArgumentException('관리 상태를 확인해 주세요.');
   $page=max(1,min(10000,(int)($_GET['page']??1)));$offset=($page-1)*60;
   $s=db()->prepare("SELECT id,post_type,nickname,caption,location_label,pattern_type,public_lat,public_lng,status,consent_version,created_at FROM circle_posts WHERE status=? ORDER BY created_at ASC,id ASC LIMIT 60 OFFSET $offset");$s->execute([$status]);
   $count=db()->prepare('SELECT COUNT(*) FROM circle_posts WHERE status=?');$count->execute([$status]);
   out(['posts'=>$s->fetchAll(),'total'=>(int)$count->fetchColumn(),'page'=>$page]);
  }
  if ($action==='collection-manage') {admin();out(['items'=>collectionItems($cfg['base_path'],true)]);}
  if ($action==='mine') {
   if(empty($_SESSION['user_id'])||($_SESSION['user_until']??0)<=time())out(['error'=>'로그인이 필요합니다.'],401);
   $page=max(1,min(10000,(int)($_GET['page']??1)));$offset=($page-1)*60;
   $s=db()->prepare("SELECT id,post_type,nickname,caption,pattern_type,location_label,public_lat,public_lng,status,created_at,approved_at FROM circle_posts WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 60 OFFSET $offset");$s->execute([$_SESSION['user_id']]);
   $count=db()->prepare('SELECT COUNT(*) FROM circle_posts WHERE user_id=?');$count->execute([$_SESSION['user_id']]);
   out(['posts'=>$s->fetchAll(),'total'=>(int)$count->fetchColumn(),'page'=>$page]);
  }
  if ($action==='list') {
   $page=max(1,min(10000,(int)($_GET['page']??1)));$take=60;$offset=($page-1)*$take;
   $where="status='approved'";$params=[];
   $type=$_GET['type']??'all';$pattern=$_GET['pattern']??'';$query=textField($_GET,'q',80);
   if(!in_array($type,['all','photo','text'],true)||!in_array($pattern,['','Geometric','Traditional','Symbol','Letter','Nature','Other'],true))throw new InvalidArgumentException('검색 조건을 확인해 주세요.');
   if($type!=='all'){$where.=' AND post_type=?';$params[]=$type;}
   if($pattern!==''){$where.=" AND post_type='photo' AND pattern_type=?";$params[]=$pattern;}
   if($query!==''){$where.=" AND LOCATE(?, CONCAT_WS(' ', location_label, nickname, caption)) > 0";$params[]=$query;}
   if(isset($_GET['south'],$_GET['north'],$_GET['west'],$_GET['east'])) {
    $south=coordinate($_GET['south'],-90,90);$north=coordinate($_GET['north'],-90,90);$west=coordinate($_GET['west'],-180,180);$east=coordinate($_GET['east'],-180,180);
    if($south>$north || $west>$east) throw new InvalidArgumentException('지도 범위를 다시 선택해 주세요.');
    $where.=" AND post_type='photo' AND public_lat BETWEEN ? AND ? AND public_lng BETWEEN ? AND ?";$params=array_merge($params,[$south,$north,$west,$east]);$take=200;$offset=0;
   }
   $s=db()->prepare("SELECT id,post_type,nickname,caption,pattern_type,location_label,public_lat,public_lng,created_at,approved_at FROM circle_posts WHERE $where ORDER BY approved_at DESC,id DESC LIMIT $take OFFSET $offset");$s->execute($params);
   $count=db()->prepare("SELECT COUNT(*) FROM circle_posts WHERE $where");$count->execute($params);out(['posts'=>$s->fetchAll(),'total'=>(int)$count->fetchColumn(),'page'=>$page]);
  }
  out(['error'=>'잘못된 요청입니다.'],404);
 }
 if($_SERVER['REQUEST_METHOD']!=='POST') out(['error'=>'지원하지 않는 요청입니다.'],405);
 csrf();
 if($action==='google-login') {
  limit('google-login',300);$input=jsonInput();$token=$input['credential']??'';
  if(!is_string($token)||!is_string($_SESSION['google_nonce']??null))throw new InvalidArgumentException('구글 로그인을 다시 시작해 주세요.');
  $claims=verifyGoogleCredential($token,googleClientId(),$_SESSION['google_nonce'],googleCertificates());
  if($claims===false)out(['error'=>'구글 계정을 확인하지 못했습니다. 다시 시도해 주세요.'],401);
  $pdo=db();$pdo->beginTransaction();
  try{
   $s=$pdo->prepare('SELECT id FROM circle_users WHERE google_sub=? FOR UPDATE');$s->execute([$claims['sub']]);$id=$s->fetchColumn();
   $name=is_string($claims['name']??null)?trim($claims['name']):'';if($name==='')$name='도시 관찰자';$name=mb_substr($name,0,120);
   if($id===false){$id=bin2hex(random_bytes(16));$s=$pdo->prepare('INSERT INTO circle_users(id,google_sub,email,display_name) VALUES (?,?,?,?)');$s->execute([$id,$claims['sub'],$claims['email'],$name]);}
   else{$s=$pdo->prepare('UPDATE circle_users SET email=?,display_name=? WHERE id=?');$s->execute([$claims['email'],$name,$id]);}
   $pdo->commit();
  }catch(Throwable $e){$pdo->rollBack();throw $e;}
  session_regenerate_id(true);
  $_SESSION['user_id']=$id;$_SESSION['user_until']=time()+43200;
  $_SESSION['google_nonce']=bin2hex(random_bytes(24));
  $_SESSION['admin']=false;unset($_SESSION['admin_until']);
  $adminEmail=$cfg['admin_google_email']??'';
  if(is_string($adminEmail)&&$adminEmail!==''&&strcasecmp($claims['email'],$adminEmail)===0&&str_ends_with(strtolower($claims['email']),'@gmail.com')){$_SESSION['admin']=true;$_SESSION['admin_until']=time()+7200;}
  out(['ok'=>true,'admin'=>$_SESSION['admin'],'user'=>['id'=>$id,'display_name'=>$name,'email'=>$claims['email']]]);
 }
 if($action==='login') {
  limit('login',10);$input=jsonInput();$password=$input['password']??'';
  if(!is_string($password)||strlen($password)>1024)throw new InvalidArgumentException('비밀번호를 확인해 주세요.');
  if(!password_verify($password,$cfg['admin_password_hash'])) out(['error'=>'비밀번호를 확인해 주세요.'],401);
  session_regenerate_id(true);$_SESSION['admin']=true;$_SESSION['admin_until']=time()+7200;out(['ok'=>true]);
 }
 if($action==='logout') { $_SESSION=[];session_regenerate_id(true);out(['ok'=>true]); }
 if($action==='moderate') {
  admin();$input=jsonInput();$id=$input['id']??'';$status=$input['status']??'';
  if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/',$id)||!in_array($status,['approved','rejected','hidden'],true)) throw new InvalidArgumentException('승인 요청을 확인해 주세요.');
  $pdo=db();$pdo->beginTransaction();
  $s=$pdo->prepare('SELECT status FROM circle_posts WHERE id=? FOR UPDATE');$s->execute([$id]);$current=$s->fetchColumn();
  if($current===false){$pdo->rollBack();out(['error'=>'기록을 찾을 수 없습니다.'],404);}
  $allowed=['pending'=>['approved','rejected'],'approved'=>['hidden'],'hidden'=>['approved'],'rejected'=>['approved']];
  if($current!==$status && !in_array($status,$allowed[$current],true)){$pdo->rollBack();out(['error'=>'기록 상태가 바뀌었습니다. 목록을 새로고침해 주세요.'],409);}
  if($current!==$status){
   if($status==='approved'){$s=$pdo->prepare('UPDATE circle_posts SET status=?,approved_at=NOW(6) WHERE id=?');$s->execute([$status,$id]);}
   else{$s=$pdo->prepare('UPDATE circle_posts SET status=? WHERE id=?');$s->execute([$status,$id]);}
  }
  $pdo->commit();out(['ok'=>true]);
 }
 if($action==='edit') {
  limit('edit',60);$input=jsonInput();$id=$input['id']??'';
  if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/',$id))throw new InvalidArgumentException('기록을 확인해 주세요.');
  if(empty($_SESSION['admin'])||($_SESSION['admin_until']??0)<=time()){
   if(empty($_SESSION['user_id'])||($_SESSION['user_until']??0)<=time())out(['error'=>'로그인이 필요합니다.'],401);
  }
  if(($input['consent']??'')!=='yes')throw new InvalidArgumentException('수정한 내용의 공개 동의가 필요합니다.');
  $nickname=textField($input,'nickname',60)?:'도시 관찰자';$caption=textField($input,'caption',500);
  $pdo=db();$pdo->beginTransaction();
  try{
   $s=$pdo->prepare('SELECT post_type,user_id,nickname,caption,status FROM circle_posts WHERE id=? FOR UPDATE');$s->execute([$id]);$row=$s->fetch();
   $isAdmin=!empty($_SESSION['admin'])&&($_SESSION['admin_until']??0)>time();
   if(!$row||(!$isAdmin&&($row['user_id']===null||$row['user_id']!==($_SESSION['user_id']??null)))){$pdo->rollBack();out(['error'=>'기록을 찾을 수 없습니다.'],404);}
   if($row['post_type']==='text'&&$caption===''){$pdo->rollBack();throw new InvalidArgumentException('글 내용을 입력해 주세요.');}
   $changed=$row['nickname']!==$nickname||$row['caption']!==$caption;
   if($changed){$s=$pdo->prepare('UPDATE circle_posts SET nickname=?,caption=?,status=?,approved_at=NULL WHERE id=?');$s->execute([$nickname,$caption,'pending',$id]);}
   $pdo->commit();out(['ok'=>true,'changed'=>$changed,'status'=>$changed?'pending':$row['status']]);
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 }
 if($action==='collection-update') {
  admin();limit('collection-update',60);$input=jsonInput();$slug=$input['slug']??'';
  if(!is_string($slug)||!array_key_exists($slug,collectionDefaults())||!is_file(__DIR__.'/assets/editorial/'.$slug.'.jpg'))throw new InvalidArgumentException('작가의 수집 사진을 확인해 주세요.');
  $title=textField($input,'title',120,true);$description=textField($input,'description',500);
  $location=textField($input,'location_label',150);$confirmed=($input['location_confirmed']??'')==='yes';
  $lat=null;$lng=null;
  if($confirmed){
   if($location==='')throw new InvalidArgumentException('확인한 장소 이름을 적어 주세요.');
   $lat=round(coordinate($input['lat']??null,-90,90),3);$lng=round(coordinate($input['lng']??null,-180,180),3);
  }
  $draftLat=null;$draftLng=null;
  if(array_key_exists('draft_lat',$input)||array_key_exists('draft_lng',$input)){
   $draftLat=coordinate($input['draft_lat']??null,-90,90);$draftLng=coordinate($input['draft_lng']??null,-180,180);
  }
  $s=db()->prepare('INSERT INTO circle_collection(slug,title,description,draft_lat,draft_lng,location_label,public_lat,public_lng,location_confirmed) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),draft_lat=COALESCE(VALUES(draft_lat),draft_lat),draft_lng=COALESCE(VALUES(draft_lng),draft_lng),location_label=VALUES(location_label),public_lat=VALUES(public_lat),public_lng=VALUES(public_lng),location_confirmed=VALUES(location_confirmed)');
  $s->execute([$slug,$title,$description,$draftLat,$draftLng,$location,$lat,$lng,$confirmed?1:0]);
  out(['ok'=>true,'slug'=>$slug,'title'=>$title,'description'=>$description,'location_label'=>$confirmed?$location:'','public_lat'=>$lat,'public_lng'=>$lng]);
 }
 if($action==='upload') {
  $data=validateUpload($_POST);
  $requestKey=$_POST['request_key']??'';if(!is_string($requestKey)||!preg_match('/^[a-f0-9]{32}$/',$requestKey)) throw new InvalidArgumentException('등록 요청을 다시 시작해 주세요.');
  $existing=db()->prepare('SELECT id,status FROM circle_posts WHERE request_key=?');$existing->execute([$requestKey]);if($saved=$existing->fetch()) out(['ok'=>true,'id'=>$saved['id'],'status'=>$saved['status']]);
  limit('upload',max(1,(int)($cfg['upload_per_ip_hour']??120)));
  $id=bin2hex(random_bytes(16));$image=null;$thumb=null;
  try {
   if($data['post_type']==='photo')[$image,$thumb]=savePhoto($_FILES['photo']??[], $cfg['storage'], $id);
   elseif(isset($_FILES['photo'])&&($_FILES['photo']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE)throw new InvalidArgumentException('글 참여에는 사진을 첨부하지 않습니다.');
   $s=db()->prepare('INSERT INTO circle_posts(id,request_key,post_type,user_id,nickname,caption,pattern_type,location_label,exact_lat,exact_lng,public_lat,public_lng,location_source,image_name,thumb_name,consent_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
   $owner=!empty($_SESSION['user_id'])&&($_SESSION['user_until']??0)>time()?$_SESSION['user_id']:null;
   $s->execute([$id,$requestKey,$data['post_type'],$owner,$data['nickname'],$data['caption'],$data['pattern'],$data['location'],$data['lat'],$data['lng'],$data['lat']===null?null:round($data['lat'],3),$data['lng']===null?null:round($data['lng'],3),$data['source'],$image,$thumb,'2026-10-v2']);
  } catch(Throwable $e) {
   // Also covers a partially written image pair, before savePhoto returned.
   foreach([$id.'.jpg',$id.'-thumb.jpg'] as $name){$path=$cfg['storage'].'/'.$name;if(is_file($path))@unlink($path);}
   if($e instanceof PDOException && ($e->errorInfo[1]??0)===1062){$existing->execute([$requestKey]);if($saved=$existing->fetch())out(['ok'=>true,'id'=>$saved['id'],'status'=>$saved['status']]);}
   throw $e;
  }
  out(['ok'=>true,'id'=>$id,'status'=>'pending'],201);
 }
 out(['error'=>'잘못된 요청입니다.'],404);
} catch(InvalidArgumentException $e) {out(['error'=>$e->getMessage()],422);} catch(Throwable $e) {
 // Keep messages, SQL, credentials and request data out of diagnostics.
 // Storage is outside public_html; cap this file to avoid unbounded growth.
 $diagnostic=gmdate('c').' '.get_class($e).' db_code='.($e instanceof PDOException?(int)($e->errorInfo[1]??0):0).PHP_EOL;
 $log=$cfg['storage'].'/diagnostics.log';
 if(is_dir($cfg['storage'])&&(!is_file($log)||filesize($log)<262144)) {
  $oldMask=umask(0077);
  try {@file_put_contents($log,$diagnostic,FILE_APPEND|LOCK_EX);@chmod($log,0600);}
  finally {umask($oldMask);}
 }
 error_log('Circle API failure: '.get_class($e));
 out(['error'=>'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'],503);
}
