# Cloudflare R2 Backup Isolation, Credential Rotation, and Legacy Object Review (2026-11-15–16)

> **Interim field notes (2026-11-16 JST).** Preserve the checked outcomes and explicit unknowns before the planned documentation edit on 2026-11-18. This is a production case record, not a generic copy-paste migration guide. No secrets, access keys, backup archives, or individual user media paths are published.

## Scope and outcome at the checkpoint

- **Service:** Mustard Mastodon production, Docker Compose, Cloudflare R2.
- **Completed:** Separated database backup destination from public media storage; transferred the existing backup archives by copy; moved Mastodon media credentials to a bucket-scoped token; recreated the three affected application containers sequentially; verified media upload/view; removed the legacy administrator rclone remote; operator revoked the old broad-scope Cloudflare R2 API token.
- **Partially verified:** A backup archive was uploaded successfully to the new private bucket **manually** after a failed scheduled run. The **next automatic cron run had not yet been verified** at this checkpoint.
- **Not completed:** Re-enabling the seven-day retention deletion, hash/integrity verification of all copied archives, full production disaster recovery, encryption of the production database backup archive, removal of original backup archives from the old bucket, and the first weekly remote-cache cleanup/Healthchecks production delivery.
- **Decision:** Do not rerun completed legacy media deletion batches and do not delete the remaining legacy objects en masse.

## 1. Database backup separated from media

The prior backup setup stored PostgreSQL dump and configuration files as a plain `.tar.gz` under the legacy nested `mustard-obj-backup/backup/` key prefix inside the media bucket `mustard-obj-backup`. The archive includes DB data and sensitive environment/configuration files; it is **not encrypted**.

A new **private**, separately permissioned R2 bucket, `mustard-db-backups`, and a dedicated `rclone` remote, `mustard-backup:`, were configured. Existing media has its own limited remote, `mustard-media:`; the unrelated Elasticsearch snapshot buckets and credentials were left alone.

The existing production `backup.sh` retained the PostgreSQL dump and archive flow, but the upload destination became:

```text
mustard-backup:mustard-db-backups/backup/
```

The script's `set -x` was changed to fail-fast behavior (`set -euo pipefail` and `umask 077`), so a failed upload does not proceed to the local archive cleanup. The earlier **seven-day deletion was intentionally disabled** pending confirmation of a successful scheduled run. The cron schedule itself was not changed: 19:00 UTC daily, or 04:00 JST the following morning.

### Backup transfer evidence

- **First scheduled attempt to the new destination (2026-11-16 04:00 JST):** Failed with R2 `403 AccessDenied`; the local archive was retained by fail-fast behavior.
- **Remediation:** `no_check_bucket = true` for the limited-permission `mustard-backup` remote, avoiding a bucket-check operation not allowed by the token. This was an observed fix for this credential/setup, not a universal requirement for all R2 clients.
- **Manual recovery of that day's archive:** `2026-11-15_19-00.tar.gz`, 3,502,998,300 bytes, uploaded successfully after an initial transient `501 NotImplemented` and retry; remote file name/size confirmed.
- **Historical migration:** The seven earlier archives (Nov 8–14) were **copied**, not moved, from the historical media-bucket backup prefix to the new private bucket. `rclone` reported 22.762 GiB transferred; comparison of name/size listings reported no missing entries.
- **Limitations:** Filename/size comparison does not establish SHA-256 equivalence or restore readiness. Source backup copies remain in the original bucket.

**Follow-up gate:** After the next cron-generated archive is confirmed in the private bucket, evaluate re-enabling the seven-day retention policy for the new destination. Do not let a rotation/retention operation inadvertently delete archives needed to recover from an unverified migration. The previously copied backup originals are a separate, deliberate cleanup decision.

## 2. Bucket-scoped media token and retirement of the old administrator token

The historical Mastodon R2 token had unnecessarily broad all-bucket **Admin Read & Write** access. The operator provisioned a new `Object Read & Write` token scoped to the media bucket `mustard-obj-backup`.

Evidence collected before and after switching:

1. The limited media token was tested through the independent `mustard-media:` remote: list, write, read, and delete of a disposable probe object succeeded (an initial transient 501 was retried).
2. Only `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the application's `.env.mastodon` were changed; other environment settings compared unchanged. The values matched the tested media remote without printing secrets.
3. Existing `web`, `sidekiq`, and `streaming` containers were recreated **one at a time** to apply updated environment variables; this was not merely a process restart. The existing images and the database/Redis/Elasticsearch services were not replaced.
4. Application health checks passed, and the operator confirmed actual media upload and viewing worked.
5. A read-only comparison confirmed the old `mustard-cloud:` rclone remote still used the historical token. A limited search of common scripts/systemd units and the user crontab found no active references in its search scope.
6. The `mustard-cloud:` remote was removed from rclone configuration; `rclone listremotes` then showed only `mustard-backup:` and `mustard-media:`.
7. The operator revoked the old broad-scope `Mastodon` token in Cloudflare; the scoped media, database backup, and existing ES tokens remained active in the displayed token list.

**Boundaries:** The reference search was not a universal audit of all outside integrations or historical ad hoc commands. Token revocation invalidates the retired credentials but does not erase archived copies of earlier configuration files. Credentials and backups containing them should remain protected.

## 3. Legacy media object inventory after cleanup

The preceding cleanup record is [Cloudflare R2 Media Maintenance and Weekly Cleanup Automation (2026-10-31–11-15)](cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md). Its earlier deletion batches remain completed; nothing in this follow-up restarts them.

Read-only `rclone size` of the old nested prefix (excluding the separate `backup/` prefix) returned:

| Nested media prefix | Objects | GiB |
| --- | ---: | ---: |
| `accounts/` | 2,270 | 0.388 |
| `cache/` | 34,138 | 1.520 |
| `custom_emojis/` | 5,609 | 0.139 |
| `media_attachments/` | 30,949 | 12.544 |
| `site_uploads/` | 32 | 0.003 |
| `system2/` | 73 | 0.007 |
| **Total** | **73,071** | **14.601** |

Displayed GiB values are rounded; they are not independently measured reclaimable space.

### Why the remaining attachment objects were retained

The final historical attachment cleanup retry log recorded:

```text
PROGRESS scanned=41504 deleted=10555 no_copy=30867 mismatch=82 freed_gib=4.001
=== LEGACY ATTACHMENT CLEANUP COMPLETE ===
DELETED=10555
ESTIMATED_FREED_GIB=4.001
```

`no_copy + mismatch = 30,949`, exactly the later reported count under the legacy `media_attachments/` prefix. This strongly suggests the remaining inventory is the set intentionally protected by the prior cleanup, **but an object-by-object identity check was not performed**. `no_copy` and `mismatch` are reasons **not** to delete unconditionally.

Other historical cleanup logs reported protected database references for avatars/headers/emoji and completion records, while preview-card deletion had reported `EXIT_CODE=0` for 191,936 eligible legacy objects. These previously completed batches were not rerun.

### Limited DB-to-R2 read-only samples

- A first sample of five historical attachment objects and five remote-thumbnail objects found no root-level counterpart through the script's directory/missing status. That check did **not** establish deletion safety.
- Another sample listed the first 100 objects in each of `media_attachments/files/109/`, `113/`, and `117/`. Parsed unique media IDs were 50, 50, and 52; present DB records were 0, 0, and **3**, respectively.
- One subsequent check mistakenly omitted the leading `117/` partition when parsing IDs and consequently reported zero examined DB records. It was **an invalid negative result**, not evidence of no references.
- Corrected read-only inspection of the same 117 sample found **three DB-linked local media objects**, matching their current computed attachment paths. All three had root-level objects of the **same size**, and none was missing. This does not prove byte-for-byte content identity or the condition of every other object.
- In the remote-thumbnail sample, four objects corresponded to records without the tested attachment field and one lacked a DB record. These observations are sample-limited.

**Decision on 2026-11-16:** Retain all remaining legacy media prefixes (`media_attachments/`, `cache/`, `accounts/`, `custom_emojis/`, `site_uploads/`, `system2/`) unless a **specific** future need, matching DB references, and validated recoverable copies justify a targeted change. Retention of legacy media is not an outstanding mass deletion failure. No new broad recovery or deletion batch was authorized.

## 4. Remaining work and scheduling

The operator scheduled the following work in Google Calendar (JST):

| Date/time (JST) | Activity | Condition |
| --- | --- | --- |
| Nov 17, 09:30–10:00 | Verify the Nov 17 04:00 automatic DB backup | Check cron result and archive in the private bucket |
| Nov 17, 10:00–10:30 | Restore seven-day backup retention | **Only if** the automatic backup succeeded |
| Nov 18, 14:30–15:00 | Decide whether old-bucket backup originals should remain | No deletion before safety decision |
| Nov 18, 15:15–16:00 | Consolidate/update mastodon-lab and handbook documentation | Preserve evidence and open conditions |
| Nov 23, 09:30–10:00 | Check first weekly media-cache cleanup and Healthchecks | Observe Nov 22 scheduled run; no forced duplicate deletion |

### Deferred, not prerequisites for this R2 cleanup

- Optional/longer-term improvement: encrypt production database backup archives (current private bucket and scoped tokens are access controls, **not** file encryption). This was discussed but **not scheduled or implemented**.
- A verified application-level production restore and per-file hash verification are distinct future exercises, not implied by successful upload or file-size checks.
- Existing Elasticsearch-only encrypted snapshot/restore work is separate from the application database backup; do not conflate their validation results.

## Publication and security boundaries

Public notes must exclude actual keys, full environment files, backup data, monitoring credentials, sensitive user media URLs, raw objects, and other recoverable secrets. The paths and service names shown here are descriptive evidence of the migration, not instructions to delete production data.
