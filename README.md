# 원의 도시 · CITY OF CIRCLES

전시 QR을 통해 멘홀 사진과 발견 장소를 등록하는 PHP/MySQL MVP.

**목표 주소:** `https://hwadongmi.soulmagics.net/circle/`

## 제공 기능

- HOME / ARCHIVE / MAP / UPLOAD / ADMIN / LIVE
- EXIF GPS, 현재 위치, 지도 핀 및 좌표 입력
- Kakao JavaScript 키 설정 시 장소 검색
- 서버 이미지 검사, JPEG 재인코딩 및 썸네일 (공개 EXIF 제거)
- 관리자 비밀번호 로그인, 승인·거절·숨김
- 승인 사진만 공개, 정확 좌표는 API에서 제외 (공개 좌표 소수점 3자리 반올림)
- LIVE 약 3초 간격 조회, 실패 시 마지막 화면 유지 및 재시도
- CSRF, 경로 전용 세션 쿠키, IP별 요청 제한, 중복 요청 키

## 설치

[Hostinger 설치 및 충돌 방지 가이드](docs/HOSTINGER_INSTALL.md)

PHP 8.2+, MySQL 8 또는 호환 MariaDB, GD, PDO MySQL, fileinfo, HTTPS가 필요합니다.
`circle/`만 사이트 문서 루트 아래에, `private-circle/`은 문서 루트의 상위 폴더에 설치합니다.
기존 홈페이지 파일, 루트 .htaccess, DNS, 기존 DB를 변경하지 않습니다.

## 실행 상태

이 저장소는 코드와 설치 패키지를 제공합니다. GitHub에 저장됐다고 서버에 배포된 것은 아닙니다.
Hostinger 실제 설정 및 전시장 기기 검증이 완료돼야 운영 준비 완료로 판단합니다.

## 검사

```sh
node --check circle/assets/app.js
php -d zend.assertions=1 -d assert.exception=1 tests/validation.php
python3 tools/package.py
```

GitHub Actions는 PHP 구문, 입력 검증 및 MySQL 업로드/검수/접근 제어 통합 검사를 수행합니다.
테스트에는 실제 운영 비밀정보를 사용하지 않습니다.

## MVP 제한

- HEIC는 브라우저가 읽을 수 있으면 JPEG로 변환, 읽지 못하면 JPEG 선택 안내
- LIVE는 WebSocket이 아닌 polling이며 5초 반영 보장은 실서버 측정 필요
- 지도는 Leaflet + OpenStreetMap 타일; 외부 네트워크 필요, 대규모 운영은 전용 타일 공급자 검토
- 지도 영역당 최대 200개 표시 (클러스터링·세계지도·배지·회원 기능은 후속 범위)
- 장소 검색은 Kakao 키와 사이트 등록 필요; 키 없이는 지도 핀/좌표 입력 사용
- CAPTCHA와 이미지 자동 검수는 미포함; 공개 전 관리자 승인 필수
- 삭제 요청은 @cloud.visualizer로 접수 후 운영자가 서버 파일과 DB에서 처리
