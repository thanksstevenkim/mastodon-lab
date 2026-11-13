# Ticket ID

SUP-0014

# Title

Cloudflare 521 during unattended glibc update: Nginx restart failed on R2 DNS resolution

# Status

**Public service restored; legacy Nginx-to-R2 S3 API request path remains unverified.** This incident is distinct from [SUP-0001](001-cloudflare-521-after-upgrade.md), an earlier 521 caused by duplicate Nginx configuration.

# Environment

- Incident: 2026-11-13 (times below in JST, UTC+09:00; system logs use UTC)
- Ubuntu 24.04, Nginx 1.24.0 (Ubuntu), Cloudflare, R2, Mastodon
- Automatic APT security updates (`apt-daily-upgrade.service`) and `needrestart`
- R2-related Nginx configuration: `/etc/nginx/conf.d/bucket.conf`

# Impact and symptoms

- Cloudflare returned **521**; the Mastodon website became unreachable.
- Nginx was inactive after a failed service restart.
- The operator recovered access by manually starting Nginx at **15:44:16 JST**.
- Exact outage start, user impact count, and any separate media-access impact were not measured.

# Evidence and timeline

| Time (JST) | Observed evidence |
| --- | --- |
| 15:39:32 | `apt-daily-upgrade.service` started. |
| 15:39:37 | `unattended-upgrade` selected `libc6`, `libc-bin`, development packages, `locales`, and AMD graphics firmware for upgrade. |
| 15:39:56–15:40:03 | `dpkg.log` recorded glibc-related package configuration. |
| 15:40:13 | systemd began stopping `nginx.service` and also restarted `cron.service`. |
| 15:40:27 | `nginx.service` stop timed out; systemd terminated it, then attempted to start it. |
| 15:40:18 (error timestamp; journal delivery at 15:40:28) | Nginx reported `host not found in upstream` for an R2 S3 API host at `bucket.conf:32`; configuration test failed. |
| 15:40:44 | `unattended-upgrades-dpkg.log` recorded the restart attempt and `nginx.service` failure. |
| 15:43:49 | Operator's `systemctl reload nginx` failed because the unit was inactive. |
| 15:44:16 | Operator's `systemctl start nginx` succeeded; public website access returned. |

The decisive package log includes:

```text
Restarting services...
 systemctl restart containerd.service cron.service ... nginx.service ... systemd-resolved.service ...
Job for nginx.service failed because the control process exited with error code.
```

These lines establish that the package-maintenance restart action **included Nginx and systemd-resolved**. They do **not** establish that systemd-resolved was unavailable at the exact instant of the failed R2 lookup.

The Nginx journal also included:

```text
nginx.service: Stopping timed out. Terminating.
nginx.service: Failed with result 'timeout'.
[emerg] host not found in upstream "...r2.cloudflarestorage.com" in /etc/nginx/conf.d/bucket.conf:32
nginx: configuration file /etc/nginx/nginx.conf test failed
```

# Root-cause assessment

**Confirmed restart trigger:** Ubuntu's unattended update/needrestart sequence requested a restart of Nginx following glibc package updates.

**Confirmed start blocker:** Nginx could not resolve the statically referenced R2 S3 API hostname during configuration loading, so its startup configuration check failed. Cloudflare consequently could not connect to the Nginx origin.

**Unconfirmed details:** Why Nginx's stop operation timed out; whether the contemporaneous `systemd-resolved` restart caused the DNS failure; and precisely which routes, beyond the public website, depended on the legacy R2 proxy. Do not treat temporal correlation as proof of the DNS service failure mechanism.

# Recovery and subsequent changes

1. Manually started Nginx; the service and website returned.
2. The operator edited `bucket.conf` to use runtime DNS resolution with a resolver and variable-based `proxy_pass`, instead of requiring the R2 hostname to resolve when loading the configuration.
3. An initial uncached localhost probe against the Nginx bucket virtual host returned **502**. Nginx's error log showed `SSL_do_handshake() failed` for the R2 upstream.
4. Enabled upstream TLS SNI using `proxy_ssl_server_name on` with the R2 host name. `nginx -t` succeeded and `systemctl reload nginx` completed.
5. The localhost probe then returned **400**. Correcting an upstream `Host` header that incorrectly contained a URL path still resulted in **400**; the XML response body was `<Code>InvalidArgument</Code><Message>Authorization</Message>`.
6. A separate public HTTPS probe of the same image via `bucket.mustard.blog`, using a cache-busting query parameter, returned **HTTP 200**, `Content-Type: image/gif`, and **`CF-Cache-Status: MISS`**.

**Interpretation:** Public media delivery was verified with a Cloudflare cache MISS, but this is **not proof** that the internal Nginx-to-R2 S3 API proxy succeeds. The direct Nginx probe still returned 400. R2's S3 API endpoint and an R2 public custom domain are different access paths; the S3 endpoint generally requires authenticated S3 requests. The live DNS/routing relationship between the public hostname and Nginx was not conclusively established in this investigation.

# Verification and outstanding scope

- Nginx configuration test: **passed** after edits.
- Nginx reload: **succeeded**.
- Public Mastodon access: **restored**, per operator.
- Public image over HTTPS, Cloudflare cache MISS: **HTTP 200**.
- Local Nginx virtual-host probe to the R2 S3 API: **HTTP 400** (`InvalidArgument / Authorization`) — **not resolved**.
- Reproduction of a future unattended update/restart: **not performed**. The dynamic resolver change was not proven by an actual restart while DNS is down.

# Lessons and operational follow-up

- For Cloudflare 521, check **origin Nginx state and journal** before restarting Mastodon containers or database services.
- Examine `unattended-upgrades-dpkg.log` for `Restarting services...`, then correlate its contents with `journalctl -u nginx` and `dpkg.log`.
- A hostname resolved at Nginx configuration-load time can block the **entire Nginx service** during restart if DNS fails at that moment.
- If using a dynamic HTTPS upstream, account for **`resolver`**, **SNI**, `Host` and URI rewriting semantics. Passing `nginx -t` alone does not prove upstream content can be fetched.
- Distinguish **Cloudflare cache HIT/MISS**, local Nginx proxy requests, and authenticated R2 S3 API requests. Never infer one path's health solely from another.
- Do not disable automatic security updates, rewrite object keys, add S3 credentials, or delete the old proxy solely on this evidence. If the legacy Nginx R2 path is revisited, first establish whether production traffic still uses it.

# References

- [Nginx proxy module: variable `proxy_pass`, URI semantics, and SNI](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Cloudflare R2 S3 API and credentials](https://developers.cloudflare.com/r2/get-started/s3/)
- [Cloudflare R2 public bucket custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
