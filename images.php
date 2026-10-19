<?php
declare(strict_types=1);

// Returns only generated filenames. The caller cleans up on any storage/DB failure.
function savePhoto(array $file, string $storage, string $id): array {
 if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK ||
     !is_uploaded_file($file['tmp_name'] ?? '') || ($file['size'] ?? 0) > 8*1024*1024) {
  throw new InvalidArgumentException('사진을 다시 선택해 주세요. 전송 사진은 최대 8MB까지 가능합니다.');
 }
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
 if(!in_array($mime,['image/jpeg','image/png','image/webp'],true))throw new InvalidArgumentException('JPEG·PNG·WebP 사진을 선택해 주세요. HEIC는 JPEG로 변환해 주세요.');
 $dimensions=@getimagesize($file['tmp_name']);
 if(!$dimensions || $dimensions[0]*$dimensions[1]>25000000)throw new InvalidArgumentException('사진 해상도가 너무 큽니다. 작은 크기로 다시 선택해 주세요.');
 // Account for decode, orientation and resize buffers before allocating GD images.
 $memory=ini_parse_quantity(ini_get('memory_limit'));
 if($memory>0 && $dimensions[0]*$dimensions[1]*10+32*1024*1024 > $memory-memory_get_usage(true))throw new InvalidArgumentException('사진 해상도가 너무 큽니다. 작은 크기로 다시 선택해 주세요.');
 $im=@imagecreatefromstring(file_get_contents($file['tmp_name']));
 if(!$im)throw new InvalidArgumentException('사진을 읽을 수 없습니다.');
 if($mime==='image/jpeg' && function_exists('exif_read_data')) {
  $ex=@exif_read_data($file['tmp_name']);$orientation=(int)($ex['Orientation']??1);
  if(in_array($orientation,[2,4,5,7],true))imageflip($im,IMG_FLIP_HORIZONTAL);
  $angle=match($orientation){3,4=>180,5,6=>-90,7,8=>90,default=>0};
  if($angle){$rotated=imagerotate($im,$angle,0);if(!$rotated)throw new RuntimeException('Image rotation failed');$im=$rotated;}
 }
 if(!is_dir($storage)&&!mkdir($storage,0700,true)&&!is_dir($storage))throw new RuntimeException('Storage unavailable');
 $image=$id.'.jpg';$thumb=$id.'-thumb.jpg';
 foreach([$image=>1600,$thumb=>480] as $filename=>$size) {
  $w=imagesx($im);$h=imagesy($im);$scale=min(1,$size/max($w,$h));
  $dest=imagecreatetruecolor(max(1,(int)($w*$scale)),max(1,(int)($h*$scale)));
  $white=imagecolorallocate($dest,255,255,255);imagefill($dest,0,0,$white);
  imagecopyresampled($dest,$im,0,0,0,0,imagesx($dest),imagesy($dest),$w,$h);
  if(!imagejpeg($dest,$storage.'/'.$filename,86))throw new RuntimeException('Image encoding failed');
  chmod($storage.'/'.$filename,0600);
 }
 return [$image,$thumb];
}
