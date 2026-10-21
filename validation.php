<?php
declare(strict_types=1);
function coordinate(mixed $value,float $min,float $max): float {
 if(!is_numeric($value)||!is_finite((float)$value)||(float)$value<$min||(float)$value>$max) throw new InvalidArgumentException('위치를 확인해 주세요.');return (float)$value;
}
function textField(array $data,string $key,int $max,bool $required=false): string {
 $v=$data[$key]??'';if(!is_string($v)) throw new InvalidArgumentException('입력 내용을 확인해 주세요.');$v=trim($v);
 if(($required&&$v==='')||!preg_match('//u',$v)||preg_match_all('/./us',$v)>$max) throw new InvalidArgumentException('입력 길이 또는 형식을 확인해 주세요.');return $v;
}
function validateUpload(array $p): array {
 $type=$p['post_type']??'photo';
 if(!in_array($type,['photo','text'],true)) throw new InvalidArgumentException('참여 유형을 확인해 주세요.');
 if(($p['consent']??'')!=='yes') throw new InvalidArgumentException('공개 동의가 필요합니다.');
 $subject=$type==='text'?null:subjectType($p['subject_type']??'unknown');
 $common=['post_type'=>$type,'subject_type'=>$subject,'nickname'=>textField($p,'nickname',60)?:'도시 관찰자','caption'=>textField($p,'caption',500,$type==='text')];
 if($type==='text')return $common+['location'=>null,'lat'=>null,'lng'=>null,'pattern'=>null,'source'=>null];
 if(($p['confirmed']??'')!=='yes') throw new InvalidArgumentException('발견 장소 확인이 필요합니다.');
 $pattern=$p['pattern']??'Other';$source=$p['source']??'pin';
 if(!in_array($pattern,['Geometric','Traditional','Symbol','Letter','Nature','Other'],true)||!in_array($source,['exif','device','search','pin'],true)) throw new InvalidArgumentException('분류 또는 위치를 확인해 주세요.');
 return $common+['location'=>textField($p,'location',150,true),'lat'=>coordinate($p['lat']??null,-90,90),'lng'=>coordinate($p['lng']??null,-180,180),'pattern'=>$pattern,'source'=>$source];
}
function subjectType(mixed $value): ?string {
 if(!in_array($value,['manhole','round','unknown'],true))throw new InvalidArgumentException('사진의 종류를 확인해 주세요.');
 return $value==='unknown'?null:$value;
}
