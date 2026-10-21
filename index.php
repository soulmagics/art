<?php
require __DIR__.'/bootstrap.php';
require __DIR__.'/google-auth.php';
require __DIR__.'/collection.php';
$base=htmlspecialchars($cfg['base_path'],ENT_QUOTES,'UTF-8');
$editorial=[];
$editorialNames=['bento-center','bento-letter','bento-rhythm','bento-yellow','bento-orange'];
// A partial new set falls back as a whole, preserving tile order and alt text.
foreach($editorialNames as $name)if(!is_file(__DIR__.'/assets/editorial/'.$name.'.jpg')){$editorialNames=['letter','rhythm','garden'];break;}
foreach($editorialNames as $name)if(is_file(__DIR__.'/assets/editorial/'.$name.'.jpg'))$editorial[]=$cfg['base_path'].'/assets/editorial/'.$name.'.jpg';
$collection=collectionItems($cfg['base_path']);
$featuredArtwork=is_file(__DIR__.'/assets/artworks/circle-of-the-world.jpg')
    ? $cfg['base_path'].'/assets/artworks/circle-of-the-world.jpg' : '';
$styleVersion=(int)filemtime(__DIR__.'/assets/style.css');
$appVersion=(int)filemtime(__DIR__.'/assets/app.js');
$discoveryVersion=(int)filemtime(__DIR__.'/assets/discovery.js');
$galleryVersion=(int)filemtime(__DIR__.'/assets/gallery.js');
header('Cache-Control: no-store');
?>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff"><title>원의 도시 · CITY OF CIRCLES</title><link rel="icon" type="image/svg+xml" href="<?= $base ?>/assets/manhole-mark.svg"><link rel="stylesheet" href="<?= $base ?>/assets/style.css?v=<?= $styleVersion ?>"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"></head><body>
<a class="skip-link" href="#app">본문으로 건너뛰기</a>
<?php if(($cfg['environment']??'production')==='local'): ?><div class="demo-label">로컬 미리보기 · 테스트 기록 · 운영 서버 아님</div><?php endif; ?>
<header><a href="<?= $base ?>/" class="brand"><img class="brand-mark" src="<?= $base ?>/assets/manhole-mark.svg" width="42" height="42" alt=""><span class="brand-type"><span class="brand-name">원의 도시</span><small>CITY OF CIRCLES</small></span></a><div class="header-links"><a href="<?= $base ?>/#gallery">모두의 동그라미</a><a id="account-link" href="<?= $base ?>/account/">로그인·내 기록</a><a class="social-link" href="https://www.instagram.com/cloud.visualizer/" target="_blank" rel="noopener">@cloud.visualizer ↗</a></div></header>
<main id="app" tabindex="-1"><p class="loading" role="status">불러오는 중…</p></main><div id="notice" role="status"></div>
<div class="participate-dock"><a class="button" href="<?= $base ?>/upload/">＋ 내 동그라미 올리기</a></div>
<script>window.CIRCLE_CONFIG=<?= json_encode(['base'=>$cfg['base_path'],'kakaoKey'=>$cfg['kakao_js_key'],'googleClientId'=>googleClientId(),'editorial'=>$editorial,'collection'=>$collection,'featuredArtwork'=>$featuredArtwork],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script src="https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/lite.umd.js"></script><script src="<?= $base ?>/assets/discovery.js?v=<?= $discoveryVersion ?>" defer></script><script src="<?= $base ?>/assets/bento.js" defer></script><script src="<?= $base ?>/assets/gallery.js?v=<?= $galleryVersion ?>" defer></script><script src="<?= $base ?>/assets/app.js?v=<?= $appVersion ?>" defer></script>
</body></html>
