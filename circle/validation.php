<?php
declare(strict_types=1);
function coordinate(mixed $value,float $min,float $max): float {
 if(!is_numeric($value)||!is_finite((float)$value)||(float)$value<$min||(float)$value>$max) throw new InvalidArgumentException('위치를 확인해 주세요.');return (float)$value;
}
function textField(array $data,string $key,int $max,bool $required=false): string {
 $v=$data[$key]??'';if(!is_string($v)) throw new InvalidArgumentException('입력 내용을 확인해 주세요.');$v=trim($v);
 if(($required&&$v==='')||preg_match_all('/./us',$v)>$max||!preg_match('//u',$v)) throw new InvalidArgumentException('입력 길이 또는 형식을 확인해 주세요.');return $v;
}
function validateUpload(array $p): array {
 if(($p['consent']??'')!=='yes'||($p['confirmed']??'')!=='yes') throw new InvalidArgumentException('공개 동의와 발견 장소 확인이 필요합니다.');
 $pattern=$p['pattern']??'Other';$source=$p['source']??'pin';
 if(!in_array($pattern,['Geometric','Traditional','Symbol','Letter','Nature','Other'],true)||!in_array($source,['exif','device','search','pin'],true)) throw new InvalidArgumentException('분류 또는 위치를 확인해 주세요.');
 return ['nickname'=>textField($p,'nickname',60)?:'도시 관찰자','caption'=>textField($p,'caption',500),'location'=>textField($p,'location',150,true),'lat'=>coordinate($p['lat']??null,-90,90),'lng'=>coordinate($p['lng']??null,-180,180),'pattern'=>$pattern,'source'=>$source];
}
