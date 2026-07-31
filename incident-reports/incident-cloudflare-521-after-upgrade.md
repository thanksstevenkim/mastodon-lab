# Cloudflare 521 after Mastodon Upgrade

## 증상

- Cloudflare 521
- Docker 컨테이너 정상
- DB 정상
- Puma 정상
- Web 접속 불가

## DownTime : 60-90 minutes

## 조사 과정

## 조사 과정

1. Docker Compose 상태 확인 (docker compose ps)
2. Web/Puma 로그 확인 → 정상 기동 확인
3. PostgreSQL 연결 확인 → 정상
4. Elasticsearch 로그 확인
5. nginx -t 수행
6. systemctl status nginx 확인 → 서비스가 기동 실패 상태

## 원인

- nginx가 R2 upstream DNS를 해석하지 못해 기동 실패.
- nginx 서비스가 내려가 Cloudflare가 원본에 연결 불가.

## 해결

- nginx -t를 돌려 설정 자체에 이상이 있는지 확인
- nginx 설정 중 중복된 설정 제거
- nginx 재시작
- 서비스 정상 확인

## 배운 점

- 521은 애플리케이션이 아니라 리버스 프록시 문제일 수도 있다.
- Docker 컨테이너뿐만 아니라, systemctl status nginx를 먼저 확인해보자.

## 재발 방지

- Cloudflare 521 발생 시 우선 nginx 상태를 확인한다.
- nginx 설정 변경 후에는 반드시 `nginx -t`로 검증한다.
- R2 upstream을 사용하는 경우 DNS 해석 실패 가능성을 고려한다.
