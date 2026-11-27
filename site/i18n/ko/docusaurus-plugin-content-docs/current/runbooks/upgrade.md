# Mastodon 업그레이드 운영 절차서 {#mastodon-upgrade-runbook}

## 목적 {#purpose}

이 절차서는 원본 Mastodon 릴리스를 유지보수 중인 포크에 병합하고, 결과 소스 트리를 검증하며, 버전이 지정된 사용자 지정 Docker 이미지를 게시하고 운영 환경에 배포한 뒤 결과를 검증하기 위해 사용합니다.

이 절차는 이 저장소의 운영 환경과 배포 작업 흐름을 반영합니다.

현재 배포된 버전부터 대상 버전까지 모든 중간 버전의 원본 릴리스 노트를 반드시 읽으십시오. 일부 Mastodon 릴리스에는 추가 런타임 요구사항, 오래 걸리는 데이터베이스 마이그레이션 또는 배포 전후 마이그레이션 절차가 도입되어 이 절차서를 상황에 맞게 조정해야 할 수 있습니다.

---

## 변수 {#variables}

작업 전 현재 버전과 대상 버전을 설정합니다.

두 값 모두 맨 앞의 `v`를 유지합니다.

```bash
export PREVIOUS_VERSION=vA.B.C
export TARGET_VERSION=vX.Y.Z
export IMAGE=mustardkim/mastodon-mustard
```

---

## 사전 조건 {#preconditions}

업그레이드를 시작하기 전에 다음을 확인합니다.

- 서비스 중단이 예상되면 유지보수 시간대를 확보합니다.

- 필요한 경우 사전에 사용자에게 공지합니다.

- `$PREVIOUS_VERSION`과 `$TARGET_VERSION` 사이의 모든 릴리스에 대한 원본 릴리스 노트를 읽습니다.

- 대상 릴리스가 현재 배포된 다음 구성요소의 버전을 지원하는지 확인합니다.
  - Ruby
  - Node.js
  - PostgreSQL
  - Redis
  - Elasticsearch (활성화된 경우)

- 작업 트리에 미반영 변경 사항이 없는지 확인합니다.

- `upstream` 원격 저장소가 다음 주소를 가리키는지 확인합니다.

  ```text
  https://github.com/mastodon/mastodon.git
  ```

- 최근 PostgreSQL 백업이 존재하는지 검증합니다.

- 업로드된 미디어가 백업되었는지 검증합니다.

- 시작하기 전에 복구 절차를 사용할 수 있는지 확인합니다.

- 현재 배포된 애플리케이션 및 Streaming 이미지 태그를 기록합니다.

- 롤백을 위해 이전 Docker 이미지를 보존합니다.

- 다음 대상에 접근할 수 있는지 확인합니다.
  - 컨테이너 레지스트리
  - 운영 호스트
  - 애플리케이션 소스 저장소

- 비용이 큰 데이터베이스 마이그레이션에 대비해 유지보수 시간이 충분한지 확인합니다.

일부 Mastodon 마이그레이션은 운영 데이터베이스에서 수십 분까지 걸릴 수 있습니다.

장시간 출력이 없다는 이유만으로 마이그레이션이 멈췄다고 판단하지 마십시오. 중단하기 전에 마이그레이션 프로세스와 데이터베이스 활동을 조사합니다.

---

## 1. 소스 준비 {#1-prepare-the-source}

원본 릴리스를 `main`에 바로 병합하지 말고 업그레이드 전용 브랜치에서 작업합니다.

```bash
cd ~/mastodon
git status --short
git remote -v
git fetch --tags upstream
git tag --verify "$TARGET_VERSION"
```

업그레이드 브랜치를 생성합니다.

```bash
git checkout -b "upgrade-${TARGET_VERSION#v}"
```

원본 릴리스를 병합합니다.

```bash
git merge --no-ff "$TARGET_VERSION"
```

병합 충돌을 신중하게 해결합니다.

충돌하는 모든 파일에서 포크 또는 원본 버전을 일괄적으로 우선하지 않습니다.

각 충돌에 대해 차이가 다음 중 무엇에 해당하는지 판단합니다.

- 의도적인 로컬 사용자 지정
- 더 이상 유효하지 않은 포크와 원본의 차이
- 의존성 또는 빌드 시스템의 변경
- 로컬 버전을 대체해야 하는 원본 애플리케이션의 변경

의존성 잠금 파일, 런타임 버전, 프레임워크 설정, 빌드 시스템 파일 및 생성된 메타데이터는 달리 적용해야 할 로컬 사유가 문서화되어 있지 않다면 일반적으로 대상 원본 릴리스를 따릅니다.

모든 충돌을 해결한 뒤 다음을 실행합니다.

```bash
git diff --check
git status
```

다음을 확인합니다.

- 충돌 표식이 남아 있지 않음
- `Unmerged paths`가 남아 있지 않음
- `git diff --check`에서 출력이 발생하지 않음

필요하다면 해결되지 않은 충돌 표식을 명시적으로 검색합니다.

```bash
git grep -nE '^(<<<<<<< |>>>>>>> )'
```

---

## 2. 소스 검증 {#2-validate-the-source}

대상 릴리스에 필요한 의존성을 설치합니다.

현재 Ruby, Node.js, Bundler 또는 Yarn 버전이 여전히 유효하다고 가정하지 말고 대상 릴리스의 런타임 요구사항을 따릅니다.

일반적인 명령어는 다음과 같습니다.

```bash
bundle install
yarn install --immutable
```

릴리스에 적합한 검사를 실행합니다.

예시:

```bash
yarn lint:js --max-warnings 0
git diff --check
```

가능한 경우 Ruby 테스트 모음을 실행합니다.

```bash
RAILS_ENV=test \
DB_HOST=localhost \
DB_USER=mastodon_test \
DB_PASS='test-password' \
bundle exec rspec
```

로컬 테스트 환경에는 다음과 같은 추가 서비스 및 도구가 필요할 수 있습니다.

- PostgreSQL
- Redis
- ffmpeg
- ffprobe

테스트 환경이 완전한지 확인하기 전까지 인프라 장애를 애플리케이션 회귀로 해석하지 마십시오.

전체 테스트 모음에서 많은 실패가 발생하면 뒤이어 발생한 연쇄 실패를 조사하기 전에 최초의 근본 예외를 식별합니다.

병합 커밋을 생성하기 전에 의도적으로 사용자 지정한 로컬 도구 설정을 검증합니다.

예시:

```bash
grep -n 'lint-staged' .husky/pre-commit
grep -nE 'rubocop|haml|tsc' lint-staged.config.js
```

검증이 완료되면 다음을 실행합니다.

```bash
git status
git commit
git push origin "upgrade-${TARGET_VERSION#v}"
```

저장소의 CI 검사가 완료될 때까지 확인합니다.

업그레이드 브랜치가 필수 검사를 통과하기 전에는 운영 이미지 빌드를 진행하지 않습니다.

---

## 3. 검증된 업그레이드를 `main`에 병합 {#3-merge-the-validated-upgrade-into-main}

업그레이드 브랜치가 로컬 검증과 CI를 통과하면 다음을 실행합니다.

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff "upgrade-${TARGET_VERSION#v}"
git push origin main
```

병합 결과의 `main` 커밋에서 운영 이미지를 빌드합니다.

빌드 전후에 정확한 소스 커밋을 기록합니다.

```bash
git rev-parse --short HEAD
```

기록한 커밋과 이미지 빌드 사이에서 소스 트리가 변경되어서는 안 됩니다.

해당 업그레이드 기록에 이 커밋 해시를 남깁니다.

---

## 4. 이미지 빌드 및 게시 {#4-build-and-publish-images}

검증된 `main` 브랜치에서 변경 불가능한 버전 태그가 지정된 애플리케이션 및 Streaming 이미지를 빌드합니다.

애플리케이션 이미지:

```bash
docker build -t "$IMAGE:$TARGET_VERSION" .
```

Streaming 이미지:

```bash
docker build \
  -f streaming/Dockerfile \
  -t "$IMAGE:$TARGET_VERSION-streaming" .
```

이미지가 생성되었는지 검증합니다.

```bash
docker images | grep mastodon-mustard
```

버전이 지정된 태그를 먼저 게시합니다.

```bash
docker push "$IMAGE:$TARGET_VERSION"
docker push "$IMAGE:$TARGET_VERSION-streaming"
```

버전이 지정된 애플리케이션 이미지가 성공적으로 빌드되고 필수 검증을 마친 뒤에만 `latest`를 이동합니다.

```bash
docker tag "$IMAGE:$TARGET_VERSION" "$IMAGE:latest"
docker push "$IMAGE:latest"
```

`latest`를 유일한 롤백 참조로 사용하지 않습니다.

새 릴리스가 운영 환경에서 안정적으로 동작할 때까지 변경 불가능한 버전 태그를 사용할 수 있도록 보존합니다.

---

## 5. 운영 배포 준비 {#5-prepare-production-deployment}

운영 호스트에서 실행합니다.

```bash
cd /opt/mastodon
```

`docker-compose.yml`의 애플리케이션 및 Streaming 이미지 태그를 `$PREVIOUS_VERSION`에서 `$TARGET_VERSION`으로 변경합니다.

실행 중인 서비스를 변경하기 전에 Compose 설정을 검증합니다.

```bash
docker compose config --quiet
```

새 이미지를 가져옵니다.

```bash
docker compose pull
```

Compose에서 예상한 이미지 태그를 참조하는지 확인합니다.

```bash
docker compose images
```

최종 설정이나 이미지 태그가 예상과 다르면 진행하지 않습니다.

---

## 6. 배포 전 마이그레이션 실행 {#6-run-pre-deployment-migrations}

배포 후 마이그레이션을 포함하는 Mastodon 릴리스에서는 실행 중인 애플리케이션을 새 버전으로 전환하기 전에 배포 전 마이그레이션만 실행합니다.

다음 명령어를 사용합니다.

```bash
docker compose run --rm \
  -e SKIP_POST_DEPLOYMENT_MIGRATIONS=true \
  web bundle exec rails db:migrate
```

실행 중인 애플리케이션 컨테이너를 교체하기 전에 이 명령이 성공적으로 완료되어야 합니다.

일부 마이그레이션은 이전 업그레이드보다 훨씬 오래 걸릴 수 있습니다.

유휴 상태로 보인다는 이유만으로 마이그레이션을 중단하지 않습니다.

명령이 실패하면 다음과 같이 대응합니다.

- 배포 중단
- 오류 출력 기록
- 데이터베이스 상태 조사
- 실패 원인을 이해하지 못한 상태에서 마이그레이션을 반복 실행하지 않음

---

## 7. 새 애플리케이션 버전 시작 {#7-start-the-new-application-version}

새 이미지를 사용하여 서비스를 시작하거나 다시 생성합니다.

```bash
docker compose up -d
```

서비스 상태를 조사합니다.

```bash
docker compose ps
```

실행 중인 컨테이너가 예상한 이미지 태그를 사용하는지 확인합니다.

```bash
docker compose images
```

다음 두 작업을 하나의 명령어로 결합하지 않는 것이 좋습니다.

```bash
docker compose down && docker compose up -d
```

시작이 실패할 경우 두 작업을 결합하면 어느 단계가 실패했는지 판별하기 어려워지고 서비스 중단 시간이 불필요하게 길어질 수 있습니다.

기존 Rails 프로세스가 이미 실행 중인 상태에서 스키마를 변경하는 마이그레이션을 적용했다면 Rails 애플리케이션 프로세스를 명시적으로 재시작합니다.

```bash
docker compose restart web sidekiq
```

이렇게 하면 ActiveRecord가 현재 데이터베이스 스키마를 다시 불러옵니다.

---

## 8. 배포 후 마이그레이션 실행 {#8-run-post-deployment-migrations}

새 애플리케이션 버전이 실행된 이후 다음을 실행합니다.

```bash
docker compose run --rm web bundle exec rails db:migrate
```

남아 있는 배포 후 마이그레이션이 실행됩니다.

완료 후 마이그레이션 상태를 확인합니다.

```bash
docker compose run --rm web bundle exec rails db:migrate:status
```

대상 릴리스에 필요한 모든 마이그레이션이 다음 상태로 표시되는지 검증합니다.

```text
up
```

데이터베이스에 문제가 있음을 확인했고 릴리스 문서에서 명시적으로 지원하는 경우가 아니라면 완료된 마이그레이션을 되돌리거나 재실행하지 않습니다.

---

## 9. 로그 확인 {#9-inspect-logs}

배포 직후 최근 애플리케이션 로그를 조사합니다.

```bash
docker compose logs --since=10m web sidekiq streaming
```

필요하면 다른 관련 서비스도 조사합니다.

```bash
docker compose logs --since=10m db redis
```

다음 항목을 확인합니다.

- HTTP 500 응답
- `NameError`
- `NoMethodError`
- `ActiveRecord` 오류
- 누락된 데이터베이스 열
- 에셋 또는 Vite 매니페스트 오류
- Sidekiq 작업 실패
- Streaming 연결 오류
- 반복되는 연합 실패

Docker 상태 검사에만 의존하지 않습니다.

컨테이너가 `healthy`로 표시되더라도 애플리케이션 요청은 런타임 예외로 실패할 수 있습니다.

---

## 10. 업그레이드 후 검증 {#10-post-upgrade-verification}

유지보수 시간대를 종료하기 전에 각 항목을 검증합니다.

### 컨테이너 {#containers}

- 예상한 모든 Compose 서비스가 실행 중입니다.
- 상태 검사가 구성된 애플리케이션 컨테이너가 정상 상태로 표시됩니다.
- 실행 중인 애플리케이션 및 Streaming 컨테이너가 의도한 대상 이미지 태그를 사용합니다.

확인:

```bash
docker compose ps
docker compose images
```

### 웹 애플리케이션 {#web-application}

- 공개 호스트 이름으로 접속할 수 있습니다.
- 웹 UI에서 HTTP 500이 반환되지 않습니다.
- 공개 타임라인이 불러와집니다.
- 테스트 계정으로 로그인할 수 있습니다.
- 테스트 계정으로 게시물을 작성할 수 있습니다.

### Streaming {#streaming}

- 페이지 전체를 새로고침하지 않아도 실시간 갱신이 표시됩니다.
- Streaming 로그에 반복되는 연결 실패가 없습니다.

### Sidekiq {#sidekiq}

- Sidekiq가 작업을 처리합니다.
- 큐가 예상치 못하게 적체되지 않습니다.
- 업그레이드 이후 반복되는 작업 실패가 나타나지 않습니다.

### 미디어 {#media}

- 이미지 업로드가 동작합니다.
- 해당하는 경우 동영상 또는 오디오 업로드가 동작합니다.
- 이미지 표시와 썸네일이 정상적으로 동작합니다.

### 연합 {#federation}

- 알려진 상대 서버와 수신 연합이 동작합니다.
- 알려진 상대 서버와 발신 연합이 동작합니다.
- 새 게시물을 원격 서버로 전달할 수 있습니다.
- 원격 게시물을 로컬에서 수신할 수 있습니다.

### 데이터베이스 {#database}

- 대상 버전의 모든 마이그레이션이 `up` 상태입니다.

확인:

```bash
docker compose run --rm web bundle exec rails db:migrate:status
```

### 로그 {#logs}

조사:

```bash
docker compose logs --since=10m web sidekiq streaming
```

새로 발생한 반복적 애플리케이션 오류가 없는지 확인합니다.

### 백업 {#backup}

- 다음 예정된 백업이 성공적으로 완료되는지 확인합니다.

---

## 11. 업그레이드 기록 작성 {#11-record-the-upgrade}

다음 디렉터리에 새 파일을 생성합니다.

```text
update-log/
```

최소한 다음 항목을 기록합니다.

- 업그레이드 날짜
- 이전 버전
- 대상 버전
- 이미지 빌드에 사용한 소스 커밋
- 이미지 태그
- 백업 참조
- 서비스 중단 시간
- 런타임 또는 의존성 변경
- 병합 충돌
- 보존한 로컬 사용자 지정
- 테스트 및 린트 결과
- 마이그레이션 결과
- 오래 걸린 마이그레이션
- 업그레이드 후 검증 결과
- 장애 또는 일반 절차에서 벗어난 사항
- 후속 조치

업그레이드 과정에서 반복될 수 있는 운영 문제를 발견했다면 다음 업그레이드에서 경험을 활용할 수 있도록 이 절차서를 갱신합니다.

---

## 롤백 {#rollback}

검증에 실패하면 다음 절차를 따릅니다.

1. 환경을 변경하기 전에 배포를 중단하고 관련 로그를 기록합니다.

2. 대상 릴리스의 데이터베이스 마이그레이션이 이전 버전과 호환되는지 판단합니다.

3. 마이그레이션된 데이터베이스에서 이전 애플리케이션 버전을 실행하기 전에 대상 릴리스 노트를 확인합니다.

4. 데이터베이스가 이전 버전과 호환된다면 `docker-compose.yml`에서 이전 애플리케이션 및 Streaming 이미지 태그를 복원합니다.

5. Compose 설정을 검증합니다.

   ```bash
   docker compose config --quiet
   ```

6. 이전 버전을 시작합니다.

   ```bash
   docker compose up -d
   ```

7. 데이터베이스가 이전 버전과 호환되지 않는다면 새 스키마에서 이전 애플리케이션을 시작하지 말고 검증된 PostgreSQL 및 미디어 복구 절차를 따릅니다.

8. 검증 체크리스트를 다시 수행합니다.

9. 다음 문서에 롤백을 기록합니다.
   - 업그레이드 기록
   - 해당하는 경우 장애 보고서

백업이 생성된 이후 기록된 데이터를 고려하지 않고 마이그레이션을 되돌리거나 데이터베이스를 복구해서는 안 됩니다.

---

## 문제 해결 {#troubleshooting}

### `git fetch upstream` 실패 {#git-fetch-upstream-fails}

설정된 원격 저장소를 조사합니다.

```bash
git remote -v
```

`upstream`이 없는 경우:

```bash
git remote add upstream https://github.com/mastodon/mastodon.git
git fetch --tags upstream
```

`upstream`이 이미 존재하지만 잘못된 URL을 가리킨다면 중복 원격 저장소를 생성하지 말고 기존 원격 저장소를 수정합니다.

---

### 대상 릴리스가 요구하는 Ruby 버전을 rbenv에서 사용할 수 없음 {#ruby-version-required-by-the-target-release-is-unavailable-in-rbenv}

`ruby-build`를 갱신합니다.

```bash
cd ~/.rbenv/plugins/ruby-build
git pull
```

필요한 버전을 사용할 수 있게 되었는지 확인합니다.

```bash
rbenv install -l
```

대상 릴리스 문서에 따라 필요한 버전을 설치합니다.

예시:

```bash
RUBY_CONFIGURE_OPTS=--with-jemalloc rbenv install X.Y.Z
rbenv rehash
```

지원되지 않는 Ruby 버전을 동작시키려는 목적으로 로컬의 `.ruby-version`을 변경하지 않습니다.

---

### RSpec에서 PostgreSQL 인증 오류 발생 {#rspec-fails-with-postgresql-authentication-errors}

테스트 데이터베이스 설정을 확인합니다.

연결을 직접 시험합니다.

```bash
PGPASSWORD='test-password' \
psql -h localhost \
  -U mastodon_test \
  -d mastodon_test \
  -c 'SELECT 1;'
```

테스트 마이그레이션 상태를 검증합니다.

```bash
RAILS_ENV=test \
DB_HOST=localhost \
DB_USER=mastodon_test \
DB_PASS='test-password' \
bundle exec rails db:migrate:status
```

실제 실패 원인을 식별하기 전에는 테스트 데이터베이스를 삭제하고 다시 생성하지 않습니다.

---

### Redis를 사용할 수 없어 RSpec 실패 {#rspec-fails-because-redis-is-unavailable}

일반적인 오류:

```text
Redis::CannotConnectError
Failed to connect to localhost:6379
```

Redis를 확인합니다.

```bash
redis-cli ping
```

예상 결과:

```text
PONG
```

Redis를 사용할 수 없다면 후속 테스트 실패를 해석하기 전에 테스트용 Redis 서비스를 복구합니다.

---

### 미디어 관련 RSpec 실패에 `ffmpeg` 또는 `ffprobe`가 언급됨 {#media-related-rspec-failures-mention-ffmpeg-or-ffprobe}

일반적인 오류:

```text
Could not run the `ffmpeg` command.
Could not run the `ffprobe` command.
```

사용 가능 여부를 확인합니다.

```bash
ffmpeg -version
ffprobe -version
```

ffmpeg가 없다면 설치합니다.

설치 후 병합으로 애플리케이션 회귀가 발생했다고 판단하기 전에 영향을 받은 미디어 테스트를 다시 실행합니다.

---

### 마이그레이션 성공 이후 웹 UI에서 HTTP 500 반환 {#web-ui-returns-http-500-after-successful-migrations}

데이터베이스 마이그레이션이 성공했다고 해서 이미 실행 중인 Rails 프로세스가 현재 데이터베이스 스키마를 다시 불러왔음이 보장되지는 않습니다.

웹 로그를 조사합니다.

```bash
docker compose logs --since=5m web
```

오래된 스키마 정보는 다음과 같은 오류를 일으킬 수 있습니다.

```text
NameError:
undefined local variable or method `requested_deletion_at'
```

마이그레이션 자체가 적용되었는지 확인합니다.

```bash
docker compose run --rm web bundle exec rails db:migrate:status
```

관련 마이그레이션이 이미 `up` 상태라면 Rails 프로세스를 재시작합니다.

```bash
docker compose restart web sidekiq
```

이후 웹 UI를 다시 불러오고 로그를 재확인합니다.

```bash
docker compose logs --since=5m web sidekiq
```

마이그레이션 상태가 실제 데이터베이스 문제를 나타내지 않는 한 마이그레이션을 다시 실행하거나 롤백하지 않습니다.

---

### 컨테이너는 정상이지만 웹 애플리케이션이 실패함 {#containers-are-healthy-but-the-web-application-is-failing}

Docker 상태 검사는 설정된 상태 확인 요청이 성공한다는 사실만 확인합니다.

모든 애플리케이션 요청이 정상적으로 동작한다는 보장은 아닙니다.

애플리케이션 로그를 조사합니다.

```bash
docker compose logs --since=5m web
```

다음도 확인합니다.

```bash
docker compose images
docker compose ps
```

실행 중인 Web 및 Sidekiq 컨테이너가 예상한 대상 이미지를 사용하는지 확인합니다.

---

### 마이그레이션이 멈춘 것처럼 보임 {#a-migration-appears-to-be-stuck}

일부 마이그레이션은 다음과 같이 비용이 큰 작업을 수행할 수 있습니다.

- 구체화된 뷰 재구축
- 큰 테이블 복사
- 인덱스 생성
- 기존 데이터 보완

프로세스를 즉시 종료하지 않습니다.

다음을 조사합니다.

- 마이그레이션 출력
- PostgreSQL 활동
- CPU 및 디스크 활동
- 잠금 상태

실제로 차단되었거나 실패했음을 확인한 뒤에만 마이그레이션을 중단합니다.

---

## 관련 장애 보고서 {#related-incident-reports}

- [업그레이드 중 Yarn 체크섬 불일치](../incidents/004-yarn-checksum-mismatch-during-upgrade.md)
- [Ruby 런타임 버전 불일치](../incidents/005-ruby-runtime-version-mismatch.md)
- [원본 저장소 병합 이후 충돌](../incidents/006-merge-conflicts-after-upstream-merge.md)
- [업그레이드 이후 미완료 데이터베이스 마이그레이션](../incidents/007-database-migration-incomplete-after-upgrade.md)
- [포크와 원본 저장소 간 차이로 인한 GitHub Actions 실패](../incidents/009-github-actions-failures-from-fork-drift.md)
