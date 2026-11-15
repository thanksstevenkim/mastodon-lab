# Mastodon 운영 연구실

[English](README.md) | **한국어**

이 저장소는 2022년 11월부터 실제 운영 중인 자체 호스팅 Mastodon 서버를 관리하며 얻은 운영 지식과 경험을 기록합니다. 일반적인 설치 안내서보다는 **실제 장애, 문제 해결, 반복적인 유지보수, 버전 업그레이드**에 초점을 맞춥니다.

다음 분야의 실무 경험을 정리합니다.

- Linux 서버 관리
- Docker 기반 애플리케이션 배포
- 장애 조사 및 문제 해결
- 백업, 복구, 인프라 유지보수
- 중재 정책과 서비스 운영
- 기술 문서화와 지속적인 개선

> **번역 안내:** 현재 상세 운영 기록과 절차 문서의 대부분은 영어로 작성되어 있습니다. 아래 링크는 별도 표시가 없는 한 영어 원문으로 연결되며, 한국어 문서는 점진적으로 추가할 예정입니다. 이 문서에서 설명하는 운영 사례는 특정 서버의 환경에 기반합니다.

## 저장소 안내

| 분류 | 내용 |
| --- | --- |
| [장애 기록](incidents/) | 실제 운영 장애, 원인 분석, 해결 과정, 재발 방지 대책 |
| [운영 절차서](runbooks/) | 반복해서 사용할 수 있는 운영 절차와 문제 해결 안내 |
| [업데이트 기록](update-log/) | 버전별 업그레이드 내역, 검증 결과, 교훈 |
| [운영 사례](operations/) | 중재 정책, 거버넌스 관련 결정, 서비스 운영 사례 |

일부 운영 절차서는 아직 작성 중입니다. **Draft**로 표시된 문서는 초안이며, 검증된 운영 절차로 간주해서는 안 됩니다.

### 주요 문서

- [2026-11-15: 웹사이트 가용성 1분 주기 점검과 Healthchecks 알림](operations/website-healthchecks-monitoring-2026-11-15.md)
- [2026-11-15: Ubuntu 24.04 패키지 유지보수와 통제된 재부팅](operations/ubuntu-24-04-package-updates-and-reboot-2026-11-15.md)
- [2026-11-15: Cloudflare R2 레거시 미디어 정리와 주간 자동화](operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md)
- [2026-11-13: Mastodon 4.7.5 보안 업데이트](update-log/4-7-5-security-upgrade-2026-11-13.md)
- [2026-11-02~03: Nori 검색의 운영 전환과 관리자 상태 점검 수정](operations/korean-nori-search-production-cutover-2026-11-02-03.md)
- [2026-10-25~26: Sidekiq·PgHero·R2 미디어 복구·Nori 도입 유지보수](operations/production-maintenance-sidekiq-pghero-r2-nori-2026-10-25-26.md)
- [2026-10-26: Sidekiq 전송 재시도 조사와 일일 점검 타이머](operations/sidekiq-delivery-retries-and-daily-audit-2026-10-26.md)
- [Mastodon 업그레이드 운영 절차서](runbooks/upgrade.md)
- [런타임 및 의존성 보안 패치 운영 절차서](runbooks/runtime-dependency-security-patches.md)
- [2026-10-22: Mastodon 4.7.3 보안 유지보수](update-log/4-7-3-security-maintenance-2026-10-22.md)
- [2026-10-25: 한국어 Nori 검색 개발 및 CI 검증](operations/korean-nori-search-development-and-ci-validation-2026-10-25.md)
- [2026-10-25: Nori 도입 전 Elasticsearch 스냅샷, R2 보관, 재해 복구 검증](operations/elasticsearch-pre-nori-snapshot-r2-archive-and-disaster-recovery-2026-10-25.md)
- [2026-10-24: Ruby 4.0.9 공식 기반 이미지와 gem 보안 패치 배포](update-log/4-7-3-ruby-4-0-9-official-base-and-gem-security-2026-10-24.md)
- [2026-10-23: Ruby 4.0.9 수동 기반 이미지 보안 패치와 배포](update-log/4-7-3-ruby-4-0-9-security-maintenance-2026-10-23.md)
- [2026-10-23: 부대찌개 서비스 종료](operations/budae-jjigae-retirement-2026-10-23.md)
- [2026-10-30: 운영자의 성찰 — 중재의 공정성과 한계](operations/moderation-fairness-and-limits-2026-10-30.md)
- [스팸 및 중재 운영 절차서](runbooks/spam-and-moderation.md)
- [Mastodon 가입 검토 봇](runbooks/mastodon-signup-review-bot.md)
- [2026-11-13: 무인 glibc 업데이트 이후 Nginx 521 장애 (SUP-0014)](incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md)
- [업그레이드 이후 Cloudflare 521 장애](incidents/001-cloudflare-521-after-upgrade.md)
- [완료되지 않은 데이터베이스 마이그레이션](incidents/007-database-migration-incomplete-after-upgrade.md)
- [포크와 원본 저장소 간 차이로 인한 GitHub Actions 실패](incidents/009-github-actions-failures-from-fork-drift.md)
- [BoomProtocolProbe를 이용한 자동 가입 남용](incidents/010-automated-registration-abuse-boomprotocolprobe.md)
- [OAuth 애플리케이션 이름 차단 목록](runbooks/oauth-application-name-blocklist.md)
- [OAuth 애플리케이션 지문 차단 목록](runbooks/oauth-application-fingerprint-blocklist.md)
- [웹 가입 전 hCaptcha 적용](runbooks/pre-registration-hcaptcha.md)

## 운영 환경

- 공개 Mastodon 인스턴스 자체 호스팅
- 2022년 11월부터 운영
- 월간 활성 사용자 최고 165명
- CPU 4코어/8스레드, 메모리 32GB, SATA HDD 4TB

## 기술 스택

- Ubuntu Server
- Docker Compose
- PostgreSQL
- Redis
- Nginx
- Cloudflare
- Git

## 적용 범위와 안전

이 저장소의 명령어와 설정은 특정 운영 환경을 기록한 것으로, 다른 서버에 적용하려면 상황에 맞게 조정해야 할 수 있습니다. 운영 절차서를 사용하기 전에 해당 Mastodon 버전의 릴리스 노트를 읽고, 예시 버전 및 경로를 실제 환경에 맞게 바꾸고, 백업을 확인하세요. 가능하다면 운영 환경이 아닌 곳에서 먼저 절차를 시험하세요.

비밀정보, 인증정보, 개인정보, 해당 서버에만 해당하는 환경 설정값은 의도적으로 공개하지 않습니다.

현재 운영 중인 보안 방어 체계를 우회하는 데 악용될 수 있는 세부 설정 역시 의도적으로 제외합니다. 예를 들어, 실서비스의 정확한 요청 제한 임계값, 현재 사용 중인 침해 지표(IOC) 및 차단 목록의 값, 원본 접근 로그, 운영 환경 전용 지표에 의존하는 재현용 페이로드 등이 이에 해당합니다.

## 이 저장소의 의미

실제 서비스를 운영한다는 것은 소프트웨어를 배포하는 것에서 끝나지 않습니다. 이 저장소는 개인이 운영하는 서비스를 장기간 안정적으로 유지하기 위해 수행한 조사, 문서화, 운영 절차 개선의 기록입니다.
