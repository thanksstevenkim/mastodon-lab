# Ubuntu 24.04 Package Maintenance and Controlled Reboot (2026-11-15)

## Scope and outcome

- **Host:** Mustard production server running Ubuntu 24.04.5 LTS.
- **Date:** 2026-11-15 (JST).
- **Goal:** Apply pending packages, install Docker/host PostgreSQL package updates, and boot into the already installed newer kernel without changing Mastodon application configuration or running a distribution release upgrade.
- **Result:** The APT upgrade completed; a controlled reboot loaded kernel `6.8.0-149-generic`. Nginx, Docker, containerd and host PostgreSQL were active after reboot. All six key Mastodon Compose services were healthy; public HTTPS returned HTTP 200 and the local Web health endpoint succeeded.
- **Scope boundary:** A successful normal reboot does **not** prove the prior DNS-related Nginx failure is impossible to reproduce under a concurrent resolver outage. This is a maintenance record, not a new incident root-cause test.

## Preflight: relevant risk distinctions

- Before maintenance, the running kernel was `6.8.0-139-generic`; reboot-required state referenced several newer kernel packages, AppArmor and glibc.
- `dpkg --audit` reported no problems. Disk free space was approximately 3.2 TB for `/` and 698 MB for `/boot`.
- An APT simulation listed **34 packages to upgrade** and `snapd` deferred because of phased rollout.
- Docker and containerd were both active; Docker `LiveRestoreEnabled=false`. Upgrading Docker therefore carried potential application interruption risk.
- Host PostgreSQL **18-main** was online on port 5432 with zero active client connections at the sampled checkpoint; **17-main** was down on port 5433. The running Mastodon database was a *separate* Docker `postgres:14-alpine` container.
- Host PostgreSQL's `/etc/postgresql/18/main/start.conf` was confirmed `auto`; `postgresql.service` was enabled.
- Mastodon Web, Sidekiq, Elasticsearch, PostgreSQL, Redis and Streaming all had Docker restart policy `always`. The signup bot was `unless-stopped`. Four Nori/DR test containers had `restart=no`, and were intentionally **not** changed to auto-start.

The reboot preparation did not involve a live database restore, search reindex, change to Docker restart policies, or re-running completed R2 cleanup work.

## Package update

The operator ran `apt-get upgrade -y` with `DEBIAN_FRONTEND=noninteractive`, `NEEDRESTART_MODE=l` and `Dpkg::Options::=--force-confold`, writing a dated log under the operator's home directory.

The terminal output reported:

```text
34 upgraded, 0 newly installed, 0 to remove and 1 not upgraded.
...
Pending kernel upgrade!
Running kernel version: 6.8.0-139-generic
The currently running kernel version is not the expected kernel version 6.8.0-149-generic.
...
No containers need to be restarted.
```

Notable packages:

| Package family | Before | After |
| --- | --- | --- |
| Docker Engine | 29.9.2 | 29.9.3 |
| containerd.io | 2.4.2-3 | 2.4.2-4 |
| Docker Compose plugin | 5.6.1 | 5.7.1 |
| PostgreSQL 18 host package | 18.6 | 18.7 |
| PostgreSQL 17 host package | 17.11 | 17.12 |
| PostgreSQL 16 host package | 16.15 | 16.16 |

The installation completed with no reported dpkg audit errors, and the immediate post-install service check returned `active` for Docker, containerd, Nginx and host PostgreSQL `18-main`. The existing reboot-required flag remained set.

`NEEDRESTART_MODE=l` constrained the `needrestart` handling but should not be interpreted as a guarantee that a package's own maintainer scripts cannot restart services.

No `apt autoremove`, `do-release-upgrade`, automatic reboot, media cleanup, or Mastodon deployment was performed as part of the APT step. The ESM Apps packages mentioned in Ubuntu's login MOTD were **not** part of the 34-package ordinary APT upgrade; they were not installed by this procedure.

## Planned reboot and post-reboot verification

The operator announced a short maintenance interruption and manually rebooted the host. After SSH access returned, a single consolidated post-reboot check showed:

| Check | Verified result |
| --- | --- |
| Running kernel | `6.8.0-149-generic` |
| Docker service | `active` |
| containerd service | `active` |
| Nginx service | `active` |
| Host PostgreSQL `18-main` | `active` |
| Docker Mastodon `db` | `healthy` |
| Docker Mastodon `es` (Nori image) | `healthy` |
| Docker Mastodon `redis` | `healthy` |
| Docker Mastodon `sidekiq` | `healthy` |
| Docker Mastodon `streaming` | `healthy` |
| Docker Mastodon `web` | `healthy` |
| `https://mustard.blog/` | HTTP 200 |
| `http://127.0.0.1:3000/health` | OK |
| `/run/reboot-required` | absent |

The Web and Sidekiq images remained the customized Mastodon **v4.7.5** image; the production Elasticsearch image remained the **8.19.15 Nori** build. No post-reboot failure was observed in this limited check.

This establishes **successful recovery of the tested production services after one normal reboot**; it does not constitute exhaustive federation delivery, end-user feature, media retrieval, or R2 backup testing.

## Relationship to the 2026-11-13 521 incident

The preceding [SUP-0014 incident](../incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md) identified a Nginx startup failure caused by inability to resolve an R2 S3 API upstream hostname during configuration loading after a service restart triggered by unattended package maintenance. The operator subsequently changed the Nginx configuration to use dynamic DNS resolution and upstream TLS SNI.

During this 2026-11-15 controlled reboot, **Nginx started successfully and the public website returned 200**. This is encouraging operational evidence, **not** proof of the Nginx–R2 S3 API route's validity or its behavior under simultaneous DNS failures. The previously documented unanswered questions remain unanswered unless separately tested.

## Operating decision

- Retain Ubuntu **24.04 LTS**; do not automatically upgrade to 26.04.1 LTS because a login banner advertises it.
- Keep ordinary unattended security updates, but perform a light **monthly** review of uninstalled packages and planned reboot requirements.
- Handle Docker and host database updates with operational awareness; reboot only when required and when access to the host control panel is available.
- Do not expand the restart policy of four Nori/DR experiment containers merely to make them run after every boot.
- Do not infer ESM Apps coverage or a missing security patch from the MOTD alone.
- Keep this record separate from Mastodon version upgrades and R2 media cleanup documentation.
