# Nginx USN-9159-1 security patch and HTTP/2 mitigation (2026-11-19)

## Scope and outcome

- **Environment:** Mustard production Mastodon instance, Ubuntu 24.04 LTS (noble), Nginx reverse proxy behind Cloudflare.
- **Trigger:** Nginx vulnerabilities disclosed on 2026-11-18, including HTTP/2-related CVE-2026-123007 and CVE-2026-123633.
- **Outcome:** Temporary HTTP/2 disablement was applied and confirmed at the origin before the official fix became available. Later the same day, the Ubuntu USN-9159-1 security update was installed and service checks passed.
- **Patched packages:** `nginx` and `nginx-common`, from `1.24.0-2ubuntu7.19` to `1.24.0-2ubuntu7.20`, via `noble-security`.
- **Boundary:** These checks verify the installed package versions, current Nginx operation, and sampled HTTP responses. They do not constitute a penetration test, a full Mastodon/federation regression test, or a claim that every unrelated vulnerability is resolved.

## Advisory and applicability

On 2026-11-19, Ubuntu issued [USN-9159-1](https://ubuntu.com/security/notices/USN-9159-1). It lists the `1.24.0-2ubuntu7.20` package for Ubuntu 24.04 LTS and fixes the disclosed Nginx vulnerabilities, including:

- CVE-2026-123007 and CVE-2026-123633: HTTP/2-related memory-handling risks, including possible code execution.
- CVE-2026-123634: name/address resolution handling risk.
- CVE-2026-118899: TLS connection handling risk.
- CVE-2026-113425: a memory-handling vulnerability also addressed by the advisory.

Inclusion in the security notice does **not** prove the Mustard deployment was exploitable through every listed vector. Before mitigation, the active Mastodon Nginx virtual host explicitly enabled HTTP/2 for IPv4 and IPv6. The recorded R2 proxy configuration also uses a resolver and variable-based `proxy_pass`, but the exact prerequisites for CVE-2026-123634 were not established by this investigation.

## Initial mitigation (before the package fix)

1. Confirmed Nginx `1.24.0-2ubuntu7.19` and HTTP/2 on both `listen 443 ssl http2;` and `listen [::]:443 ssl http2;` in `/etc/nginx/conf.d/mastodon.conf`.
2. Backed up the configuration to `/etc/nginx/conf.d/mastodon.conf.bak-http2-20261118T224611Z` (UTC-stamped filename).
3. Removed only the `http2` listen options, leaving the existing HTTPS listener and other proxy settings intact. `nginx -t` succeeded.
4. `systemctl reload nginx` completed successfully; the service remained active.
5. A direct origin probe initially failed local CA certificate verification. A repeat diagnostic probe with certificate validation disabled **only for that localhost-origin request** returned `ORIGIN HTTP=200 PROTOCOL=1.1`. The separately validated public endpoint returned `PUBLIC HTTP=200 PROTOCOL=2`.
6. This confirmed the tested origin connection no longer negotiated HTTP/2, while public Cloudflare-facing HTTP/2 remained available. It did not resolve unrelated TLS, resolver, or other advisory issues.

## Official package update

- APT policy on the server showed installed `1.24.0-2ubuntu7.19` and candidate `1.24.0-2ubuntu7.20` sourced from `http://security.ubuntu.com/ubuntu noble-security`.
- `nginx -t` passed before installation. Existing `resolver` and proxy configurations were observed; they were not modified.
- The dry run `apt-get -s install --only-upgrade nginx nginx-common` reported **2 upgrades, 0 new installs, 0 removals, 14 other packages not upgraded**.
- Backups of both `/etc/nginx/conf.d/mastodon.conf` and `/etc/nginx/conf.d/bucket.conf` were created with `pre-usn-9159-1-` UTC-stamped suffixes.
- Applied only `nginx` and `nginx-common` through `apt-get install --only-upgrade`, preserving existing config files. The installation output reported `Upgrading binary nginx [ OK ]`, no package errors, and no additional services or containers needing restarts.
- No `apt autoremove`, distribution upgrade, Mastodon image rebuild, Docker restart, or unrelated package update was performed.

## Post-update production checks

| Check | Observed outcome |
| --- | --- |
| `nginx` | `1.24.0-2ubuntu7.20` installed |
| `nginx-common` | `1.24.0-2ubuntu7.20` installed |
| `nginx -t` | Syntax and configuration test successful |
| `systemctl is-active nginx` | `active` |
| Running Nginx master executable | `/usr/sbin/nginx` (no deleted executable suffix) |
| Direct origin request (`mustard.blog` resolved to `127.0.0.1`) | `HTTP=200 PROTOCOL=1.1` |
| Public HTTPS request | `HTTP=200 PROTOCOL=2` |

The update and observed checks did not reproduce the earlier Cloudflare 521 outage. The previous 2026-11-13 incident involved an Nginx startup failure when an R2 upstream name could not be resolved during an unattended-update-related restart; no conclusion is drawn here about how the resolver would behave during a future outage. See [SUP-0014](../incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md).

## Operating decision and remaining scope

- **Completed:** Official Ubuntu security patch installed and sampled production endpoints confirmed responsive.
- **Retained intentionally:** HTTP/2 disabled on the origin for now. Re-enabling it is an optional separate decision, not a prerequisite for closure.
- **No further immediate action:** Do not restart Nginx, rerun package installation, or repeat validation just for this record.
- **Monitoring:** Use the existing [website health check](../operations/website-healthchecks-monitoring-2026-11-15.md). The temporary ChatGPT advisory-watch automation was paused after successful patch validation.
- **Documentation:** Record in `mastodon-lab`; no separate general-purpose `ko-handbook` procedure is needed for this deployment-specific patch event.

## References

- [Ubuntu USN-9159-1 — nginx vulnerabilities](https://ubuntu.com/security/notices/USN-9159-1)
- [CVE-2026-123007](https://ubuntu.com/security/CVE-2026-123007)
- [CVE-2026-123633](https://ubuntu.com/security/CVE-2026-123633)
- [SUP-0014: Nginx DNS-related 521 outage](../incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md)
