# Mastodon 4.7.5 보안 업데이트 (2026-11-13~15)

## 범위 및 상태 {#scope-and-status}

- **인스턴스:** 자체 호스팅 Mastodon인 머스타드. Ubuntu에서 Docker Compose 사용, Nginx, Elasticsearch 및 사용자 지정 한국어 Nori 검색 구성.
- **기존 운영 버전:** 4.7.4.
- **대상 버전:** 4.7.5.
- **결과:** Web과 Sidekiq를 동일한 로컬 빌드 4.7.5 이미지로 배포했으며 컨테이너 상태 검사를 통과했습니다. Nginx 설정 재로드가 성공했고 공개 HTTPS는 200을 반환했습니다. Nori 읽기 경로는 활성 상태를 유지했으며 관리자 시스템 점검에서 불일치하는 Elasticsearch 인덱스가 보고되지 않았습니다.
- **검증 범위:** 이 검사는 관측된 배포 상태를 확인합니다. 전체 회귀 검사, 정확한 중단 시간, 한국어 검색 품질에 대한 완전한 종단 간 검증을 입증하지는 않습니다.

## 소스 및 이미지 {#source-and-image}

기존 사용자 지정 `origin/main`에서 업그레이드 브랜치 `upgrade-4.7.5`를 생성하여 공식 원본 저장소의 4.7.5 변경 사항을 병합했습니다. 충돌 없이 병합을 완료했으며 사용자 지정 Nori 소스 파일은 유지했습니다.

- 병합 커밋: `1842ee0195b845ae07254562f00f5bf01272ea75`
- 운영 Web/Sidekiq 이미지: `mustardkim/mastodon-mustard:v4.7.5-ruby4.0.9-1842ee0195`
- Ruby: 4.0.9
- Streaming, PostgreSQL, Redis 및 Elasticsearch는 기존 서비스 이미지와 설정을 유지했습니다.

빌드된 이미지의 정적 검사에서 Mastodon 버전 4.7.5와 관련 Nori 코드의 존재를 확인했습니다. 이미지 빌드는 성공했으나 Dockerfile의 `chown -R ... /opt/mastodon/tmp` 단계에서 느린 OverlayFS/ext4 copy-up 동작이 관측되었습니다. 이 최적화는 별개 작업으로 보류했으며 배포를 완료하기 위한 재빌드는 필요하지 않았습니다.

Web과 Sidekiq에 적용되는 Docker Compose 이미지 값은 **오버라이드** 파일에서 변경했습니다. 이번 배포에서 기본 Compose 파일은 수정하지 않았으며 날짜를 포함한 오버라이드 파일의 백업을 보존했습니다.

## Nginx Forwarded 헤더 보안 강화 {#nginx-forwarded-header-hardening}

활성 Mastodon Nginx 설정의 프록시 처리 위치 세 곳에서 아래 설정으로 수신 `Forwarded` 헤더를 제거했습니다.

```nginx
proxy_set_header Forwarded "";
```

설정 백업 후 `nginx -t`를 통과했으며 `systemctl reload nginx`로 적용했습니다. 이는 Nginx 설정 재로드이며, 호스트 재부팅이나 데이터베이스·Redis·Elasticsearch 재시작이 **아닙니다**.

## 운영 환경 검증 {#production-validation}

| 확인 항목 | 관측 결과 |
| --- | --- |
| Web 이미지 | 4.7.5 이미지, `healthy` |
| Sidekiq 이미지 | 동일한 4.7.5 이미지, `healthy` |
| `nginx -t` | 성공 |
| `systemctl reload nginx` | 성공, 서비스 `active` |
| 공개 `https://mustard.blog/` | HTTP 200 |
| 내부 `http://127.0.0.1:3000/health` | OK |
| Rails `Mastodon::Version.to_s` | `4.7.5` |
| `NoriSearch::ReadIndexes.enabled?` | `true` |
| 관리자 Elasticsearch `mismatched_indexes` | `[]` |

전체 재색인이나 Nori 재해 복구 검사 반복은 필요하지 않았습니다. 운영자는 사용자에게 간결한 버전 업데이트 공지도 게시했습니다.

## 운영 후속 조치 {#operational-follow-up}

- 롤백을 위해 기존 이미지, Compose 및 설정 백업을 보존합니다. 불필요한 이미지 정리를 피합니다.
- 컨테이너의 정상 상태만을 애플리케이션 및 연합 기능의 전체 회귀 검사로 해석하지 않습니다.
- 별개의 Ubuntu 보안 업데이트 및 재부팅 계획은 따로 관리합니다.
- R2 레거시 캐시 유지보수 및 주간 자동화는 [Cloudflare R2 미디어 유지보수](../operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md)에 기록되어 있습니다.

이 기록에는 인증정보나 비공개 사용자 미디어가 포함되지 않습니다.
