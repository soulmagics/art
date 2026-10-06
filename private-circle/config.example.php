<?php
return [
 'dsn' => 'mysql:host=localhost;dbname=CHANGE_ME;charset=utf8mb4',
 'db_user' => 'CHANGE_ME', 'db_password' => 'CHANGE_ME',
 'admin_password_hash' => 'CHANGE_ME',
 'storage' => __DIR__ . '/storage',
 'base_path' => '/circle',
 'secure_cookies' => true,
 'upload_per_ip_hour' => 120,
 // Kakao JavaScript app key; register the HTTPS site origin in Kakao Developers.
 'kakao_js_key' => '',
 'rate_secret' => 'CHANGE_ME_RANDOM_64_HEX',
];
