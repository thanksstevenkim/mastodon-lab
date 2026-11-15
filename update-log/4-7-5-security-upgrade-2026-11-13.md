# Mastodon 4.7.5 Security Upgrade (2026-11-13–15)

## Scope and status

- **Instance:** Mustard, self-hosted Mastodon; Docker Compose on Ubuntu with Nginx, Elasticsearch and customized Korean Nori search.
- **Previous production release:** 4.7.4.
- **Target release:** 4.7.5.
- **Outcome:** Web and Sidekiq deployed on the same locally built 4.7.5 image and passed their container health checks. Nginx configuration was reloaded successfully; public HTTPS returned 200. Nori read-routing remained enabled, with no mismatched Elasticsearch indexes reported by the admin system check.
- **Boundary:** These checks confirm the observed deployment state. They do not prove full regression coverage, precise downtime, or complete end-to-end Korean search quality.

## Source and image

The upgrade branch `upgrade-4.7.5` was created from the existing customized `origin/main` and merged the official upstream 4.7.5 changes. The merge completed without conflicts, and the customized Nori source files were retained.

- Merge commit: `1842ee0195b845ae07254562f00f5bf01272ea75`
- Production Web/Sidekiq image: `mustardkim/mastodon-mustard:v4.7.5-ruby4.0.9-1842ee0195`
- Ruby: 4.0.9
- Streaming, PostgreSQL, Redis and Elasticsearch retained their existing service images and settings.

A static check of the built image confirmed Mastodon version 4.7.5 and presence of the relevant Nori code. The image build succeeded, but a slow OverlayFS/ext4 copy-up in the Dockerfile's `chown -R ... /opt/mastodon/tmp` stage was observed; this was deferred as an unrelated optimization. No rebuild was required to complete deployment.

The effective Docker Compose image values for Web and Sidekiq were changed in the **override** file; the base Compose file was not edited in this deployment. A dated backup of the override was retained.

## Nginx Forwarded-header hardening

The active Mastodon Nginx configuration was adjusted to clear inbound `Forwarded` headers in three proxying locations via:

```nginx
proxy_set_header Forwarded "";
```

The configuration was backed up, passed `nginx -t`, and subsequently applied using `systemctl reload nginx`. This was an Nginx reload, **not** a host reboot or database/Redis/Elasticsearch restart.

## Production validation

| Check | Observed result |
| --- | --- |
| Web image | 4.7.5 image; `healthy` |
| Sidekiq image | same 4.7.5 image; `healthy` |
| `nginx -t` | successful |
| `systemctl reload nginx` | successful; service `active` |
| Public `https://mustard.blog/` | HTTP 200 |
| Internal `http://127.0.0.1:3000/health` | OK |
| Rails `Mastodon::Version.to_s` | `4.7.5` |
| `NoriSearch::ReadIndexes.enabled?` | `true` |
| Admin Elasticsearch `mismatched_indexes` | `[]` |

No full reindex or repeated Nori disaster-recovery test was needed. The operator also published a concise user-facing version-upgrade notice.

## Operational follow-up

- Keep existing image/Compose/config backups available for rollback; avoid unnecessary image pruning.
- Do not interpret container health alone as full application and federation regression testing.
- Track unrelated Ubuntu security updates/reboot planning separately.
- Legacy R2 cache maintenance and its weekly automation are recorded in [Cloudflare R2 media maintenance](../operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md).

This record contains no credentials or private user media.
