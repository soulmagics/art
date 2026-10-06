# ART — 원의 도시

전시장 관람객이 QR코드를 스캔하여 직접 촬영한 멘홀 사진과 발견 장소를 등록하는 참여형 아카이브.

## 현재 상태

개발 계획만 등록된 초기 저장소입니다. 실행 가능한 앱, 데이터베이스, 서버 배포는 아직 없습니다.

## 배포 목표

- 주소: https://hwadongmi.soulmagics.net/circle/
- Hostinger Business 웹호스팅에 독립 PHP 앱 배포
- 별도 MySQL 데이터베이스와 사진 저장 공간 사용
- 화동미전 홈페이지와 메뉴, 관리자 및 데이터 분리
- Lovable, Vercel, Supabase는 필수 의존성에서 제외
- 실제 설치 전 기존 사이트 유형, PHP 확장, MySQL 및 문서 루트 확인 필요

## MVP

1. HOME / ARCHIVE: 승인된 사진만 공개
2. UPLOAD: 사진 선택 → EXIF 위치 추출 → 현재 위치 또는 지도 보정 → 위치 확인 → 제출
3. MAP: 승인 사진의 공개 좌표 표시, 사진과 지도 상호 탐색
4. ADMIN: 로그인, 대기 사진 확인, 승인/거절/숨김
5. LIVE: 승인 항목을 약 3초 간격으로 조회하여 전시장 표시

## 구현 원칙

- PHP 서버 API와 PDO prepared statements로 MySQL 접근
- 서버에서 파일 형식과 크기를 검사하고 이미지 재인코딩 및 썸네일 생성
- 공개 이미지의 EXIF 제거, 정확한 좌표와 공개 좌표 분리
- 미승인 이미지 원본은 웹에서 직접 접근할 수 없는 위치에 보관
- 관리자 세션, CSRF 방어, 업로드 횟수 제한 및 공개 동의
- 서버 응답 확인 후에만 업로드 완료 표시
- DB 비밀번호 및 운영 설정은 웹 문서 루트 밖에 저장하고 Git에 커밋하지 않음
- /circle/ 기본 경로에 맞춰 자산 경로와 라우팅 구성
- iPhone Safari 사진/HEIC 처리, 위치 권한 거절, 업로드 재시도 검증
- 전시장 동시 접속 및 LIVE 반영 시간은 실제 호스팅에서 측정

## 예정 구조

```text
circle/             배포할 공개 파일과 프론트엔드
server/             웹 문서 루트 밖의 PHP 설정과 서버 코드
 database/          MySQL 초기 스키마 (구현 시 database/ 경로 사용)
docs/               설치 및 운영 가이드
```

## 설치 전 확인

Hostinger hPanel에서 화동미전 사이트의 제작 방식(PHP/HTML, WordPress, Website Builder 등), 파일 관리자, MySQL 메뉴와 실제 문서 루트를 확인합니다. Website Builder에서 운영 중인 경우 동일 도메인의 /circle 경로 설치 가능 여부를 별도로 검토합니다.
