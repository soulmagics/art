<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
require __DIR__.'/validation.php';
try {
 $action = $_GET['action'] ?? 'list';
 if ($_SERVER['REQUEST_METHOD']==='GET') {
  if ($action==='session') out(['csrf'=>$_SESSION['csrf'], 'admin'=>!empty($_SESSION['admin']) && ($_SESSION['admin_until']??0)>time()]);
  if ($action==='image') {
   $id=$_GET['id']??''; if(!preg_match('/^[a-f0-9]{32}$/',$id)) out(['error'=>'사진을 찾을 수 없습니다.'],404);
   $s=db()->prepare('SELECT status,image_name,thumb_name FROM circle_posts WHERE id=?');$s->execute([$id]);$row=$s->fetch();
   if (!$row || ($row['status']!=='approved' && (empty($_SESSION['admin']) || ($_SESSION['admin_until']??0)<time()))) out(['error'=>'사진을 찾을 수 없습니다.'],404);
   $name=($_GET['thumb']??'')==='1'?$row['thumb_name']:$row['image_name'];$path=$cfg['storage'].'/'.basename($name);
   if (!is_file($path)) out(['error'=>'사진 파일이 없습니다.'],404);
   header('Content-Type: image/jpeg');header('Cache-Control: private, no-store');session_write_close();readfile($path);exit;
  }
  if ($action==='pending') { admin(); $s=db()->query("SELECT id,nickname,caption,location_label,pattern_type,public_lat,public_lng,status,created_at FROM circle_posts WHERE status='pending' ORDER BY created_at ASC LIMIT 60");out(['posts'=>$s->fetchAll()]); }
  if ($action==='list') {
   $page=max(1,min(10000,(int)($_GET['page']??1)));$take=60;$offset=($page-1)*$take;
   $where="status='approved'";$params=[];
   if(isset($_GET['south'],$_GET['north'],$_GET['west'],$_GET['east'])) {
    $south=coordinate($_GET['south'],-90,90);$north=coordinate($_GET['north'],-90,90);$west=coordinate($_GET['west'],-180,180);$east=coordinate($_GET['east'],-180,180);
    if($south>$north || $west>$east) throw new InvalidArgumentException('지도 범위를 다시 선택해 주세요.');
    $where.=' AND public_lat BETWEEN ? AND ? AND public_lng BETWEEN ? AND ?';$params=[$south,$north,$west,$east];$take=200;$offset=0;
   }
   $s=db()->prepare("SELECT id,nickname,caption,pattern_type,location_label,public_lat,public_lng,created_at,approved_at FROM circle_posts WHERE $where ORDER BY approved_at DESC,id DESC LIMIT $take OFFSET $offset");$s->execute($params);
   $count=(int)db()->query("SELECT COUNT(*) FROM circle_posts WHERE status='approved'")->fetchColumn();out(['posts'=>$s->fetchAll(),'total'=>$count,'page'=>$page]);
  }
  out(['error'=>'잘못된 요청입니다.'],404);
 }
 if($_SERVER['REQUEST_METHOD']!=='POST') out(['error'=>'지원하지 않는 요청입니다.'],405);
 csrf();
 if($action==='login') {
  limit('login',10);$input=json_decode(file_get_contents('php://input'),true)??[];
  if(!password_verify((string)($input['password']??''),$cfg['admin_password_hash'])) out(['error'=>'비밀번호를 확인해 주세요.'],401);
  session_regenerate_id(true);$_SESSION['admin']=true;$_SESSION['admin_until']=time()+7200;out(['ok'=>true]);
 }
 if($action==='logout') { $_SESSION=[];session_regenerate_id(true);out(['ok'=>true]); }
 if($action==='moderate') {
  admin();$input=json_decode(file_get_contents('php://input'),true)??[];$id=$input['id']??'';$status=$input['status']??'';
  if(!preg_match('/^[a-f0-9]{32}$/',$id)||!in_array($status,['approved','rejected','hidden'],true)) throw new InvalidArgumentException('승인 요청을 확인해 주세요.');
  $s=db()->prepare("UPDATE circle_posts SET status=?,approved_at=CASE WHEN ?='approved' THEN NOW(6) ELSE approved_at END WHERE id=?");$s->execute([$status,$status,$id]);out(['ok'=>true]);
 }
 if($action==='upload') {
  $data=validateUpload($_POST);
  $requestKey=$_POST['request_key']??'';if(!is_string($requestKey)||!preg_match('/^[a-f0-9]{32}$/',$requestKey)) throw new InvalidArgumentException('등록 요청을 다시 시작해 주세요.');
  $existing=db()->prepare('SELECT id,status FROM circle_posts WHERE request_key=?');$existing->execute([$requestKey]);if($saved=$existing->fetch()) out(['ok'=>true,'id'=>$saved['id'],'status'=>$saved['status']]);
  limit('upload',max(1,(int)($cfg['upload_per_ip_hour']??120)));$f=$_FILES['photo']??null;
  if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name'])||$f['size']>12*1024*1024) throw new InvalidArgumentException('사진을 다시 선택해 주세요. 최대 12MB까지 가능합니다.');
  $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
  if(!in_array($mime,['image/jpeg','image/png','image/webp'],true)) throw new InvalidArgumentException('JPEG·PNG·WebP 사진을 선택해 주세요. HEIC는 JPEG로 변환해 주세요.');
  $dimensions=@getimagesize($f['tmp_name']);
  if(!$dimensions||$dimensions[0]*$dimensions[1]>25000000) throw new InvalidArgumentException('사진 해상도가 너무 큽니다. 작은 크기로 다시 선택해 주세요.');
  $im=@imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$im) throw new InvalidArgumentException('사진을 읽을 수 없습니다.');
  if($mime==='image/jpeg' && function_exists('exif_read_data')) {
   $ex=@exif_read_data($f['tmp_name']);$o=(int)($ex['Orientation']??1);
   if(in_array($o,[2,4,5,7],true)) imageflip($im,IMG_FLIP_HORIZONTAL);
   $angle=match($o){3,4=>180,5,6=>-90,7,8=>90,default=>0};if($angle) {$rot=imagerotate($im,$angle,0);imagedestroy($im);$im=$rot;}
  }
  $id=bin2hex(random_bytes(16));$image=$id.'.jpg';$thumb=$id.'-thumb.jpg';
  if(!is_dir($cfg['storage'])&&!mkdir($cfg['storage'],0700,true)) throw new RuntimeException('Storage');
  foreach([$image=>1600,$thumb=>480] as $filename=>$size) {
   $w=imagesx($im);$h=imagesy($im);$scale=min(1,$size/max($w,$h));$dest=imagecreatetruecolor(max(1,(int)($w*$scale)),max(1,(int)($h*$scale)));$white=imagecolorallocate($dest,255,255,255);imagefill($dest,0,0,$white);imagecopyresampled($dest,$im,0,0,0,0,imagesx($dest),imagesy($dest),$w,$h);
   if(!imagejpeg($dest,$cfg['storage'].'/'.$filename,86)) throw new RuntimeException('Encode');imagedestroy($dest);
  }
  imagedestroy($im);
  try {
   $s=db()->prepare('INSERT INTO circle_posts(id,request_key,nickname,caption,pattern_type,location_label,exact_lat,exact_lng,public_lat,public_lng,location_source,image_name,thumb_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
   $s->execute([$id,$requestKey,$data['nickname'],$data['caption'],$data['pattern'],$data['location'], $data['lat'],$data['lng'],round($data['lat'],3),round($data['lng'],3),$data['source'],$image,$thumb]);
  } catch(Throwable $e) {@unlink($cfg['storage'].'/'.$image);@unlink($cfg['storage'].'/'.$thumb);throw $e;}
  out(['ok'=>true,'id'=>$id,'status'=>'pending'],201);
 }
 out(['error'=>'잘못된 요청입니다.'],404);
} catch(InvalidArgumentException $e) {out(['error'=>$e->getMessage()],422);} catch(Throwable $e) {error_log('Circle API: '.$e->getMessage());out(['error'=>'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'],503);}
