<?php
declare(strict_types=1);

// A display credit is not ownership or authorization. Never infer it from a nickname.
function artistAccount(?string $userId): bool {
 global $cfg;
 if(!$userId||empty($cfg['admin_google_email']))return false;
 $s=db()->prepare('SELECT COUNT(*) FROM circle_users WHERE id=? AND email=?');
 $s->execute([$userId,$cfg['admin_google_email']]);return (int)$s->fetchColumn()===1;
}

function galleryResult(array $query): array {
 global $cfg;
 $subject=$query['subject']??'all';$creator=$query['creator']??'all';$view=$query['view']??'photos';
 if(!in_array($subject,['all','manhole','round','text','unknown'],true)||!in_array($creator,['all','rami','participants'],true)||!in_array($view,['photos','map'],true))throw new InvalidArgumentException('보기 조건을 확인해 주세요.');
 $q=textField($query,'q',80);$author=textField($query,'author',60);$page=max(1,min(10000,(int)($query['page']??1)));$take=24;
 $credit="(p.artist_credit=1 OR (u.email=? AND u.email<>''))";
 $params=[$cfg['admin_google_email']??'',$cfg['admin_google_email']??''];
 // Native bound strings and older tables may have different collations on Hostinger.
 // Normalize the query result, not stored data, before UNION with editorial values.
 $text=static fn(string $expression,string $alias):string=>"CONVERT($expression USING utf8mb4) COLLATE utf8mb4_unicode_ci AS $alias";
 $sql='SELECT '.implode(',',[
  $text("CONCAT('post:',p.id)",'item_key'),$text("'post'",'origin'),$text('p.id','id'),$text('p.post_type','post_type'),
  $text("CASE WHEN p.post_type='text' THEN 'text' ELSE COALESCE(p.subject_type,'unknown') END",'subject'),
  $text("CASE WHEN $credit THEN 'rami' ELSE 'participants' END",'creator'),
  $text("CASE WHEN $credit THEN '라미' ELSE p.nickname END",'author'),
  $text("CASE WHEN p.post_type='photo' THEN p.location_label ELSE '남긴 글' END",'title'),
  $text('p.caption','caption'),$text('p.location_label','location_label')]).",p.public_lat,p.public_lng,
 CONVERT('' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS src,0 AS sort_group,p.approved_at AS sort_time
 FROM circle_posts p LEFT JOIN circle_users u ON p.user_id=u.id WHERE p.status='approved'";
 // Editorial assets join the same query and pagination, without copying them into visitor records.
 foreach(collectionItems($cfg['base_path']) as $item){
  $sql.=" UNION ALL SELECT ?,'collection',?,'photo','manhole','rami','라미',?,?,?,?,?,?,1,NULL";
  array_push($params,'collection:'.$item['slug'],$item['slug'],$item['title'],$item['description'],$item['location_label'],$item['public_lat'],$item['public_lng'],$item['src']);
 }
 $where='1=1';
 if($subject!=='all'){$where.=' AND subject=?';$params[]=$subject;}
 if($creator!=='all'){$where.=' AND creator=?';$params[]=$creator;}
 if($author!==''){$where.=' AND author=?';$params[]=$author;}
 if($q!==''){$where.=" AND LOCATE(?,CONCAT_WS(' ',title,caption,location_label,author))>0";$params[]=$q;}
 $from=" FROM ($sql) gallery WHERE $where";
 $count=db()->prepare('SELECT COUNT(*)'.$from);$count->execute($params);$total=(int)$count->fetchColumn();
 $count=db()->prepare('SELECT COUNT(*)'.$from." AND post_type='photo' AND public_lat IS NOT NULL AND public_lng IS NOT NULL");$count->execute($params);$mapped=(int)$count->fetchColumn();
 if($view==='map')$from.=" AND post_type='photo' AND public_lat IS NOT NULL AND public_lng IS NOT NULL";
 $visibleTotal=$view==='map'?$mapped:$total;$pages=max(1,(int)ceil($visibleTotal/$take));
 $focus=textField($query,'focus',120);
 if($focus!==''){
  $rank=db()->prepare('SELECT position FROM (SELECT item_key,ROW_NUMBER() OVER (ORDER BY sort_group,sort_time DESC,item_key) AS position'.$from.') ranked WHERE item_key=?');
  $rank->execute([...$params,$focus]);$position=$rank->fetchColumn();
  if($position!==false)$page=(int)ceil((int)$position/$take);
 }
 $page=min($page,$pages);$offset=($page-1)*$take;
 $s=db()->prepare('SELECT item_key,origin,id,post_type,subject,creator,author,title,caption,location_label,public_lat,public_lng,src'.$from." ORDER BY sort_group,sort_time DESC,item_key LIMIT $take OFFSET $offset");$s->execute($params);$items=$s->fetchAll();
 foreach($items as &$item){
  if($item['origin']==='post'&&$item['post_type']==='photo')$item['src']=$cfg['base_path'].'/api.php?action=image&id='.$item['id'];
  $item['thumb']=$item['origin']==='post'&&$item['post_type']==='photo'?$item['src'].'&thumb=1':$item['src'];
 }unset($item);
 return ['items'=>$items,'total'=>$visibleTotal,'all_total'=>$total,'mapped_total'=>$mapped,'page'=>$page,'pages'=>$pages];
}
