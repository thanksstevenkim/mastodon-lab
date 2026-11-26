# Nginx USN-9182-1 post-update verification (2026-11-27)

## Scope and outcome

- Environment: Mustard production Mastodon, Ubuntu 24.04 LTS, Nginx behind Cloudflare.
- Ubuntu published [USN-9182-1](https://ubuntu.com/security/notices/USN-9182-1) on Nov 20, 2026. The Noble fixed Nginx package version is `1.24.0-2ubuntu7.21`. Relevant issues include denial of service under certain try_files/alias configurations (CVE-2026-125283) and information disclosure during TLS ClientHello parsing (CVE-2026-123640). The deployment-specific exploitability was not assessed.
- The Nov 27 review found the fixed packages already installed. No manual installation, restart, reload, or configuration change was needed.
- Prior checkpoint: [USN-9159-1, Nov 19](nginx-usn-9159-1-security-patch-2026-11-19.md).

## Recorded installation history

The package logs showed these upgrades (server log timestamps; timezone not independently verified):

```text
2026-11-22 06:18:50 upgrade nginx:amd64 1.24.0-2ubuntu7.20 1.24.0-2ubuntu7.21
2026-11-22 06:18:53 upgrade nginx-common:all 1.24.0-2ubuntu7.20 1.24.0-2ubuntu7.21
```

The installation actor was not established. An unattended security update is plausible but not confirmed.

## Nov 27 verification results

| Check | Observed result |
| --- | --- |
| Installed nginx and nginx-common | Both `1.24.0-2ubuntu7.21` |
| APT metadata refresh and package policy | Both candidates `1.24.0-2ubuntu7.21`; available from noble-security and noble-updates |
| Scoped APT simulation | 0 upgrades, 0 new installs, 0 removals; 61 unrelated packages not upgraded |
| `nginx -t` | Passed |
| `systemctl is-active nginx` | active |
| Running master executable | `/usr/sbin/nginx` |
| Running master executable and installed binary SHA-256 | Identical: `6fa7bcff852a5498e63940784fb42f1419e7a54ac4272ea470bec9c46f2fb254` |
| Public HTTPS health endpoint | HTTP 200 |

The matching hashes confirm that the running master executable matches the installed binary. The checks establish a sampled operational checkpoint, not a comprehensive security or application regression audit. Origin HTTP/2 negotiation was not retested; the prior decision to keep origin HTTP/2 disabled remains unchanged.

## Closure

- No additional Nginx package installation or restart required on the observed evidence.
- No unrelated package upgrade, autoremove, Docker operation, or production configuration change was performed during this review.
- No new user notice or general-purpose handbook entry is needed for this verification-only event.
- Continue existing monitoring; investigate only if a new advisory, alert, or configuration change warrants it.
