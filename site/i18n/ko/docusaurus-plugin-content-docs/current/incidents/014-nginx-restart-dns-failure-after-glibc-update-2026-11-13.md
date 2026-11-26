# 사건 번호 {#ticket-id}

SUP-0014

# 제목 {#title}

무인 glibc 업데이트 중 Cloudflare 521 발생: R2 DNS 이름 확인 실패로 Nginx 재시작 실패

# 상태 {#status}

**공개 서비스는 복구되었으나 기존 Nginx에서 R2 S3 API로 연결되는 요청 경로는 여전히 검증되지 않았습니다.** 이번 장애는 Nginx 설정 중복으로 발생했던 이전 521 장애인 [SUP-0001](001-cloudflare-521-after-upgrade.md)과 별개의 사건입니다.

# 환경 {#environment}

- 장애 발생일: 2026-11-13 (아래 시각은 JST, UTC+09:00이며 시스템 로그는 UTC 사용)
- Ubuntu 24.04, Nginx 1.24.0 (Ubuntu), Cloudflare, R2, Mastodon
- APT 자동 보안 업데이트 (`apt-daily-upgrade.service`) 및 `needrestart`
- R2 관련 Nginx 설정: `/etc/nginx/conf.d/bucket.conf`

# 영향 및 증상 {#impact-and-symptoms}

- Cloudflare에서 **521**을 반환하여 Mastodon 웹사이트에 접속할 수 없었습니다.
- 서비스 재시작 실패 후 Nginx가 비활성 상태였습니다.
- 운영자가 **15:44:16 JST**에 Nginx를 수동으로 시작하여 접속을 복구했습니다.
- 정확한 장애 시작 시각, 영향을 받은 사용자 수, 별도의 미디어 접근 영향은 측정하지 않았습니다.

# 근거 및 시간순 기록 {#evidence-and-timeline}

| 시각 (JST) | 관측 근거 |
| --- | --- |
| 15:39:32 | `apt-daily-upgrade.service` 시작. |
| 15:39:37 | `unattended-upgrade`가 `libc6`, `libc-bin`, 개발 패키지, `locales`, AMD 그래픽 펌웨어를 업데이트 대상으로 선택. |
| 15:39:56–15:40:03 | `dpkg.log`에 glibc 관련 패키지 설정 기록. |
| 15:40:13 | systemd가 `nginx.service` 중지를 시작하고 `cron.service`도 재시작. |
| 15:40:27 | `nginx.service` 중지 시간 초과. systemd가 서비스를 종료한 뒤 시작 시도. |
| 15:40:18 (오류 발생 시각, 저널 전달 15:40:28) | Nginx가 `bucket.conf:32`의 R2 S3 API 호스트에 대해 `host not found in upstream` 오류 보고. 설정 검사 실패. |
| 15:40:44 | `unattended-upgrades-dpkg.log`에 재시작 시도와 `nginx.service` 실패 기록. |
| 15:43:49 | 운영자의 `systemctl reload nginx` 명령이 비활성 유닛 때문에 실패. |
| 15:44:16 | 운영자의 `systemctl start nginx` 성공. 공개 웹사이트 접속 복구. |

핵심 패키지 로그는 다음과 같습니다.

```text
Restarting services...
 systemctl restart containerd.service cron.service ... nginx.service ... systemd-resolved.service ...
Job for nginx.service failed because the control process exited with error code.
```

이 기록은 패키지 유지보수 과정의 재시작 대상에 **Nginx와 systemd-resolved가 모두 포함되었음**을 보여 줍니다. 그러나 R2 이름 확인이 실패한 정확한 순간에 systemd-resolved를 사용할 수 없었다는 사실까지 입증하지는 않습니다.

Nginx 저널에도 다음 내용이 있었습니다.

```text
nginx.service: Stopping timed out. Terminating.
nginx.service: Failed with result 'timeout'.
[emerg] host not found in upstream "...r2.cloudflarestorage.com" in /etc/nginx/conf.d/bucket.conf:32
nginx: configuration file /etc/nginx/nginx.conf test failed
```

# 근본 원인 평가 {#root-cause-assessment}

**확인된 재시작 계기:** Ubuntu의 자동 업데이트 및 needrestart 과정에서 glibc 패키지 업데이트 이후 Nginx 재시작을 요청했습니다.

**확인된 시작 실패 원인:** 설정 로딩 중 정적으로 참조된 R2 S3 API 호스트 이름을 확인하지 못해 Nginx의 시작 전 설정 검사가 실패했습니다. 그 결과 Cloudflare가 Nginx 원본 서버에 연결할 수 없었습니다.

**미확인 사항:** Nginx 중지 작업의 시간 초과 원인, 같은 시기에 발생한 `systemd-resolved` 재시작이 DNS 실패를 일으켰는지 여부, 공개 웹사이트 외에 기존 R2 프록시에 의존했던 정확한 요청 경로입니다. 시간상 상관관계를 DNS 서비스 장애 원리의 증거로 간주하지 마십시오.

# 복구 및 후속 변경 {#recovery-and-subsequent-changes}

1. Nginx를 수동으로 시작하여 서비스와 웹사이트 접속을 복구했습니다.
2. 운영자는 설정을 로딩할 때 R2 호스트 이름을 확인해야 하는 방식 대신 resolver 및 변수 기반 `proxy_pass`를 통한 실행 시점 DNS 확인을 사용하도록 `bucket.conf`를 수정했습니다.
3. 캐시를 거치지 않는 Nginx 버킷 가상 호스트의 초기 로컬 요청은 **502**를 반환했습니다. Nginx 오류 로그에 R2 업스트림의 `SSL_do_handshake() failed`가 기록되었습니다.
4. R2 호스트 이름을 사용하여 `proxy_ssl_server_name on`으로 업스트림 TLS SNI를 활성화했습니다. `nginx -t`와 `systemctl reload nginx`가 성공했습니다.
5. 이후 로컬 요청은 **400**을 반환했습니다. URL 경로가 잘못 포함된 업스트림 `Host` 헤더를 수정한 후에도 **400**이 반환되었으며 XML 응답 본문은 `<Code>InvalidArgument</Code><Message>Authorization</Message>`였습니다.
6. 같은 이미지에 대해 캐시 무효화용 쿼리 매개변수를 사용한 `bucket.mustard.blog` 공개 HTTPS 요청은 **HTTP 200**, `Content-Type: image/gif`, **`CF-Cache-Status: MISS`**를 반환했습니다.

**해석:** Cloudflare 캐시 MISS 상태에서 공개 미디어 전송을 검증했지만, 이것이 내부 Nginx에서 R2 S3 API로 연결되는 프록시 요청의 성공을 **입증하는 것은 아닙니다**. 직접 Nginx 요청은 여전히 400을 반환했습니다. R2 S3 API 엔드포인트와 R2 공개 사용자 지정 도메인은 서로 다른 접근 경로이며, S3 엔드포인트는 일반적으로 인증된 S3 요청이 필요합니다. 공개 호스트 이름과 Nginx 사이의 실제 DNS 및 라우팅 관계는 이번 조사에서 확정하지 못했습니다.

# 검증 결과 및 미해결 범위 {#verification-and-outstanding-scope}

- Nginx 설정 검사: 수정 후 **통과**.
- Nginx 설정 재로드: **성공**.
- 공개 Mastodon 접속: 운영자 확인에 따르면 **복구**.
- Cloudflare 캐시 MISS 상태의 공개 HTTPS 이미지: **HTTP 200**.
- Nginx 가상 호스트를 통한 R2 S3 API 로컬 요청: **HTTP 400** (`InvalidArgument / Authorization`) — **미해결**.
- 향후 자동 업데이트 및 재시작 재현: **미실시**. 실제 DNS 장애 중 재시작으로 동적 resolver 변경의 효과를 입증하지 않았습니다.

# 교훈 및 운영 후속 조치 {#lessons-and-operational-follow-up}

- Cloudflare 521 발생 시 Mastodon 컨테이너나 데이터베이스 서비스를 재시작하기 전에 **원본 Nginx의 상태와 저널**을 확인합니다.
- `unattended-upgrades-dpkg.log`에서 `Restarting services...`를 찾아 `journalctl -u nginx` 및 `dpkg.log`와 대조합니다.
- Nginx 설정 로딩 시 확인하는 호스트 이름은 재시작 순간 DNS가 실패하면 **Nginx 서비스 전체**의 시작을 막을 수 있습니다.
- 동적 HTTPS 업스트림을 사용할 때는 **`resolver`**, **SNI**, `Host` 및 URI 재작성 동작을 고려합니다. `nginx -t` 통과만으로 업스트림 콘텐츠를 가져올 수 있음이 입증되지는 않습니다.
- **Cloudflare 캐시 HIT/MISS**, 로컬 Nginx 프록시 요청, 인증된 R2 S3 API 요청을 구분합니다. 한 경로의 정상 여부만으로 다른 경로의 정상 상태를 추론하지 않습니다.
- 이번 근거만으로 자동 보안 업데이트를 비활성화하거나 객체 키를 재작성하거나 S3 인증정보를 추가하거나 기존 프록시를 삭제하지 않습니다. 기존 Nginx R2 경로를 다시 검토한다면 먼저 실제 운영 트래픽에서 여전히 사용하는지 확인합니다.

# 참고 자료 {#references}

- [Nginx 프록시 모듈: 변수 기반 `proxy_pass`, URI 동작 및 SNI](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Cloudflare R2 S3 API 및 인증정보](https://developers.cloudflare.com/r2/get-started/s3/)
- [Cloudflare R2 공개 버킷 사용자 지정 도메인](https://developers.cloudflare.com/r2/buckets/public-buckets/)
