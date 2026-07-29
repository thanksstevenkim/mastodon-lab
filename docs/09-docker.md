# Docker Compose

## 사용 이유

Mastodon은 여러 컨테이너로 구성되어 있기 때문에 Docker Compose를 사용했다.

## 구성

- web
- sidekiq
- streaming

## 트러블슈팅

- Docker Build 실패
- 원인
  rbenv(bundle), yarn 등의 패키지 업데이트가 안되어 있음.
- 해결
  즉시 해당 패키지를 업데이트하여 재빌드.
