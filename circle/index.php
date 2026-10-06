<?php
require __DIR__.'/bootstrap.php';
$base=htmlspecialchars($cfg['base_path'],ENT_QUOTES,'UTF-8');
header('Cache-Control: no-store');
?>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>원의 도시 · CITY OF CIRCLES</title><link rel="stylesheet" href="<?= $base ?>/assets/style.css"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"></head><body>
<header><a href="<?= $base ?>/" class="brand">원의 도시 <small>CITY OF CIRCLES</small></a><a href="https://www.instagram.com/cloud.visualizer/" target="_blank" rel="noopener">@cloud.visualizer ↗</a></header>
<main id="app" aria-live="polite"></main><div id="notice" role="status"></div>
<nav><a href="<?= $base ?>/archive/">Archive</a><a href="<?= $base ?>/map/">Map</a><a href="<?= $base ?>/upload/" class="add">◎ 사진 올리기</a><a href="<?= $base ?>/live/">Live</a></nav>
<script>window.CIRCLE_CONFIG=<?= json_encode(['base'=>$cfg['base_path'],'kakaoKey'=>$cfg['kakao_js_key']],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script src="https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/lite.umd.js"></script><script src="<?= $base ?>/assets/app.js" defer></script>
</body></html>
