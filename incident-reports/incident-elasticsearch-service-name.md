# Elasticsearch Service Name Mismatch after Upgrade

## 증상

- Sidekiq의 Temporary Failure in Name Resolution

## 조사 과정

1. Docker Container 확인
2. Console 컨테이너 부재 확인
3. docker-compose.yml 파일 업데이트 및 기존 파일 백업
4. Elasticsearch 컨테이너 확인

## 원인

- 환경변수에서 가리키는 ES_HOST 이름과 실제 컨테이너 이름이 차이가 있음.

## 해결

1. 기존 docker-compose.yml 백업
2. 최신 compose 파일 적용
3. Web, Sidekiq, ES 설정 비교
4. ES_HOST를 `elasticsearch`에서 `es`로 수정
5. 컨테이너 재생성
6. Sidekiq에서 Elasticsearch 연결 확인

## 배운 점

- YAML 파일을 업데이트한다 해도 기존 설정을 백업해둬서 설정을 복원할 수 있어야 한다.
- 컨테이너 이름이 변경되었으면 전부 일치시켜야 한다.

## Impact

- Web UI 접근 불가
- API 접근 불가
- Federation 일시 중단
- DownTime: 60~90 minutes
