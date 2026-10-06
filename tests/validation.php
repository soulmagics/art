<?php
require __DIR__.'/../circle/validation.php';
$valid=['consent'=>'yes','confirmed'=>'yes','location'=>'서울 성동구','lat'=>'37.5','lng'=>'127','pattern'=>'Other','source'=>'pin'];
assert(validateUpload($valid)['lat']===37.5);
assert(validateUpload($valid)['nickname']==='도시 관찰자');
foreach([
 array_replace($valid,['consent'=>'no']),array_replace($valid,['confirmed'=>'no']),
 array_replace($valid,['lat'=>'91']),array_replace($valid,['lng'=>'NaN']),
 array_replace($valid,['location'=>'']),array_replace($valid,['pattern'=>'bad']),
 array_replace($valid,['source'=>'bad']),array_replace($valid,['caption'=>str_repeat('가',501)]),
 array_replace($valid,['nickname'=>['bad']]),
] as $input){try{validateUpload($input);throw new RuntimeException('Invalid input accepted');}catch(InvalidArgumentException $expected){}}
echo "Validation tests passed\n";
