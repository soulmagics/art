<?php
declare(strict_types=1);

function collectionDefaults(): array {
 return [
  'collection-arrow'=>'붉은 화살표와 동심원',
  'collection-tiger'=>'호랑이의 선',
  'collection-triangle'=>'삼각형이 모인 원',
  'collection-red'=>'붉은 자갈 무늬',
  'collection-maze'=>'작은 미로',
  'collection-grid'=>'검은 격자와 꽃',
  'collection-double'=>'두 겹의 무늬',
  'collection-rings'=>'겹겹의 원',
  'collection-sun'=>'햇살 같은 무늬',
  'collection-dots'=>'점으로 채운 원',
 ];
}

function collectionItems(string $base,bool $admin=false): array {
 $saved=[];
 $columns='slug,title,description,location_label,location_confirmed,public_lat,public_lng'.($admin?',draft_lat,draft_lng':'');
 foreach(db()->query('SELECT '.$columns.' FROM circle_collection')->fetchAll() as $row)$saved[$row['slug']]=$row;
 $items=[];
 foreach(collectionDefaults() as $slug=>$defaultTitle){
  if(!is_file(__DIR__.'/assets/editorial/'.$slug.'.jpg'))continue;
  $row=$saved[$slug]??[];
  $confirmed=(int)($row['location_confirmed']??0)===1;
  $item=['slug'=>$slug,'src'=>$base.'/assets/editorial/'.$slug.'.jpg','title'=>$row['title']??$defaultTitle,'description'=>$row['description']??'',
   'location_label'=>$confirmed?($row['location_label']??''):'',
   'public_lat'=>$confirmed?($row['public_lat']??null):null,'public_lng'=>$confirmed?($row['public_lng']??null):null];
  if($admin){$item['draft_location_label']=$row['location_label']??'';$item['draft_lat']=$row['draft_lat']??null;$item['draft_lng']=$row['draft_lng']??null;$item['location_confirmed']=$confirmed;}
  $items[]=$item;
 }
 return $items;
}
