# Hostinger 설치 및 운영 가이드

## 확인된 기존 사이트 응답

2026-10-06 공개 홈페이지는 제목 `화동미전 아카이브`, Next.js 응답 헤더와 `_next/static` 자산을 반환했습니다.
이는 PHP 직접 설치 가능 여부를 증명하지 않습니다. 실제 hPanel에서 Node.js 앱인지, 정적 파일인지, Builder인지 먼저 확인해야 합니다.
Node.js 앱이면 같은 경로에서 PHP 실행을 보장할 수 없습니다. 별도 PHP 서비스와 경로 프록시 지원을 확인하거나 기존 서버 방식에 맞게 백엔드를 조정해야 합니다.
이 패키지는 PHP 지원 문서 루트용이며 현 홈페이지에 배포 완료된 상태가 아닙니다.

## 0. 배포 전 확인 — 기존 사이트 보존

이 가이드는 PHP/HTML 또는 WordPress가 올라간 Hostinger 웹호스팅에 적용합니다.
Business라는 상품명만으로 기존 사이트 유형을 알 수 없습니다.
Website Builder로 운영 중이면 같은 도메인 경로에 PHP를 업로드할 수 있는지 먼저 확인하세요.
지원하지 않으면 기존 사이트를 옮기거나 도메인을 바꾸기 전에 운영자와 구성을 재결정해야 합니다.

1. hPanel에서 `hwadongmi.soulmagics.net`의 실제 문서 루트를 확인합니다. 상위 도메인의 public_html과 혼동하지 마세요.
2. 기존 홈페이지와 DB를 백업하고, 홈페이지와 주요 하위 페이지의 정상 화면을 기록합니다.
3. 기존 `/circle` 폴더 또는 해당 URL을 사용하는 페이지가 있는지 확인합니다. 존재하면 덮어쓰지 마세요.
4. 원래 홈페이지의 루트 `.htaccess`, index 파일, DNS, SSL, DB 설정은 변경하지 않습니다.
5. PHP 8.2 이상, GD/JPEG, PDO MySQL, fileinfo 확인. EXIF 확장은 원본 JPEG 회전 처리용으로 권장합니다.

## 1. 패키지 배치

ZIP은 **웹 루트에서 통째로 풀지 않습니다.** 로컬에서 풀거나 비공개 임시 폴더에서 푼 뒤 아래대로 이동합니다.

문서 루트가 `/home/ACCOUNT/domains/SITE/public_html`인 예시:

- `circle/` -> `/home/ACCOUNT/domains/SITE/public_html/circle/`
- `private-circle/` -> `/home/ACCOUNT/domains/SITE/private-circle/`
- database, docs, tools, tests, ZIP, README는 웹 루트에 올리지 않습니다.
- `private-circle/config.example.php`를 같은 비공개 폴더의 `config.php`로 복사합니다.
- `private-circle/storage`를 생성하고 계정 사용자에게만 읽기/쓰기 권한을 부여합니다 (가능하면 0700).
- config.php는 가능하면 0600. 파일/폴더 소유자가 PHP 실행 사용자여야 합니다. 0777을 사용하지 마세요.

코드는 `circle/bootstrap.php` 위치에서 두 단계 위의 `private-circle/config.php`를 읽습니다.
문서 루트 구조가 다르면 비공개 설정의 절대 경로를 bootstrap.php에 지정하세요.
private-circle을 public_html 내부로 옮기지 마세요.

## 2. 독립 데이터베이스

hPanel → MySQL Databases에서 **새 DB와 새 사용자**를 생성합니다.
이 사용자는 원의 도시 DB만 접근하도록 설정합니다.
새 DB를 선택한 phpMyAdmin에서 `database/001_initial.sql`을 한 번 가져옵니다.
기존 화동미전 DB에는 실행하지 마세요. 스키마는 circle_posts, circle_limits 두 테이블입니다.

## 3. 비공개 서버 설정

`private-circle/config.php`에서 다음을 입력합니다.

- dsn: `mysql:host=localhost;dbname=실제DB명;charset=utf8mb4` (실제 Hostinger DB 호스트 확인)
- db_user / db_password: 새 DB 계정
- admin_password_hash: 비밀번호 해시
- rate_secret: 무작위 32바이트 이상 비밀값
- base_path: `/circle`
- secure_cookies: `true`
- storage: config.php와 같은 비공개 폴더 내부 storage의 절대 경로 또는 기본값
- kakao_js_key: Kakao JavaScript 앱 키 (장소 검색용, 공개 가능한 키)

비밀번호 원문을 설정 파일에 넣지 않습니다. SSH 또는 로컬 PHP에서:

```sh
php tools/hash-password.php
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

첫 명령은 관리자 해시, 둘째는 rate_secret을 생성합니다.
config.php, DB 비밀번호, 해시, 운영 사진은 GitHub에 커밋하지 마세요.

Kakao Developers 앱의 JavaScript 키를 사용하고 플랫폼 웹사이트 도메인에
`https://hwadongmi.soulmagics.net`을 등록합니다. JavaScript 키에 REST 비밀키를 넣지 않습니다.
지도 자체는 OpenStreetMap이라 Kakao 키 없이 표시됩니다. 키 없이 장소 검색은 사용할 수 없습니다.

## 4. 사전 점검

SSH 사용 가능 시 tools/preflight.php를 비공개 위치에서 실행합니다:

```sh
php tools/preflight.php /절대경로/private-circle/config.php
```

SSH가 없으면 hPanel의 PHP 확장 설정, phpMyAdmin 테이블, 저장 폴더 권한을 확인하고 다음 브라우저 검사를 수행합니다.
진단용 PHP 파일이나 웹 설치 마법사를 공개 경로에 임시로 올리지 않습니다.

## 5. URL 및 충돌 검증

1. 기존 홈페이지 `/`와 기존 주요 페이지가 배포 전과 동일하게 동작하는지 확인합니다.
2. `/circle/`, `/circle/upload/`, `/circle/archive/`, `/circle/map/`, `/circle/admin/`, `/circle/live/` 모두 확인합니다.
3. 사진 제출 시 pending 등록 → 공개 목록과 지도에는 미표시.
4. 다른 브라우저 관리자에서 승인 → 공개 목록/지도 표시 → 태블릿 LIVE 확인.
5. 관리자 로그아웃 상태로 미승인 이미지 API를 호출하면 404인지 확인합니다.
6. 공개 API가 exact_lat, exact_lng 또는 비공개 파일 경로를 반환하지 않는지 확인합니다.
7. 공개 사진을 내려받아 EXIF GPS가 없는지 확인합니다.
8. 390px 휴대폰 가로 스크롤, 사진 회전, HEIC 안내, GPS 권한 거절과 지도 입력을 확인합니다.
9. 새로고침/중복 클릭/네트워크 끊김 후 재시도에서 중복 사진이 생기지 않는지 확인합니다.
10. `/private-circle/config.php`로 비밀 파일이 접근되지 않음을 확인합니다.

기존 사이트의 모든 경로를 프론트 라우터가 가로채거나 /circle 하위 경로가 404라면
루트 .htaccess를 곧바로 수정하지 마세요. 하위 폴더 라우팅 지원 여부를 확인합니다.
필요하면 `/circle/?screen=upload`처럼 query routing으로 전환하거나 특정 circle 경로만 제외하는 변경을 별도 검토합니다.
현재 구현은 Apache/LiteSpeed 하위 폴더 rewrite가 필요합니다.

## 6. 전시 운영

- QR 목적지는 업로드 직행 `https://hwadongmi.soulmagics.net/circle/upload/` 권장.
- 태블릿은 `/circle/live/` 열고 화면 자동 꺼짐 해제. 화면 전체화면은 기기/브라우저에서 설정.
- 관리자는 별도 기기 `/circle/admin/` 사용. 2시간 후 세션 만료 시 재로그인.
- LIVE 3초 polling은 목표 설정이며 실서버에서 승인→표시 시간을 측정합니다.
- 기본 한 시간 IP당 업로드 120회 제한이므로 동일 전시장 와이파이에서 많은 관람객이 참여하면
  config.php의 upload_per_ip_hour를 운영 계획에 따라 조정하세요. 모바일 데이터 분산 또는 별도 CAPTCHA 적용을 검토합니다.
- HTTPS와 카메라·위치 권한을 실제 iPhone Safari / Android Chrome에서 확인.
- DB 및 private-circle/storage를 함께 백업. 관리자 숨김은 파일 삭제가 아닌 공개 중단입니다.
- 공개 동의·삭제 요청 연락처가 전시 운영 방식과 일치하는지 확인.
- 외부 CDN/타일/검색 서비스는 네트워크 의존성이 있습니다. 전시장 환경에서 사전 시험 필수.

## 7. 되돌리기

문제가 생기면 새 circle 폴더만 비공개 위치로 이동해 URL 접근을 중단합니다.
기존 홈페이지, DNS, 루트 설정, 기존 DB는 그대로 유지합니다.
새 DB·storage는 바로 삭제하지 말고 백업한 뒤 원인 확인합니다.
업데이트 시 config.php와 storage를 패키지로 덮어쓰지 않습니다.
