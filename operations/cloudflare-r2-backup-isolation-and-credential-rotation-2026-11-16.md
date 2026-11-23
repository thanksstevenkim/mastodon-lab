# Cloudflare R2 Backup Isolation, Credential Rotation, and Legacy Object Review (2026-11-15–23)

> **Consolidated production case record, updated 2026-11-23 JST.** Historical operations, observed outcomes, and remaining verification limits are distinguished. Not a generic copy-paste procedure; no secrets, access keys, or archive contents are published.

## Scope and verified outcome

- **Service:** Mustard Mastodon production, Docker Compose, Cloudflare R2.
- **Completed:** Dedicated private R2 database backup bucket and scoped credentials; seven historical archives copied; Mastodon media token scoped to the media bucket and verified with real upload/view; old all-bucket administrator token revoked; **scheduled backups on Nov 17 and 18 confirmed**; **seven-day retention re-enabled on Nov 17 and observed in the Nov 18 inventory**.
- **Not demonstrated:** Full DB/Mastodon restore, cryptographic equivalence of historical archive copies, or production DB archive encryption. The Nov 22 first weekly media cleanup succeeded with a server-side Healthchecks `DELIVERED` log; independent provider-side receipt was not checked.
- **Decisions:** Continue to **preserve** the 73,071 residual old-path media objects. Seven original archives in the old media-bucket backup prefix were temporarily retained on Nov 18, then **explicitly deleted on Nov 23** after private-bucket seven-day rotation and an exact-path dry run were confirmed. No legacy media cleanup batch was restarted.
- **Evidence boundary:** File uploads, object existence, and retention operation are not proof of full restore readiness.

## 1. Database backup separated from media

The prior backup setup stored PostgreSQL dump and configuration files as a plain `.tar.gz` under the legacy nested `mustard-obj-backup/backup/` key prefix inside the media bucket `mustard-obj-backup`. The archive includes DB data and sensitive environment/configuration files; it is **not encrypted**.

A new **private**, separately permissioned R2 bucket, `mustard-db-backups`, and a dedicated `rclone` remote, `mustard-backup:`, were configured. Existing media has its own limited remote, `mustard-media:`; the unrelated Elasticsearch snapshot buckets and credentials were left alone.

The existing production `backup.sh` retained the PostgreSQL dump and archive flow, but the upload destination became:

```text
mustard-backup:mustard-db-backups/backup/
```

The script's `set -x` was changed to fail-fast behavior (`set -euo pipefail` and `umask 077`), so a failed upload does not proceed to local cleanup. The prior **seven-day deletion was intentionally disabled during migration**, then re-enabled on Nov 17 after the first confirmed automatic upload. The cron schedule remained 19:00 UTC daily, or 04:00 JST the next morning.

### Backup transfer evidence

- **First scheduled attempt to the new destination (2026-11-16 04:00 JST):** Failed with R2 `403 AccessDenied`; the local archive was retained by fail-fast behavior.
- **Remediation:** `no_check_bucket = true` for the limited-permission `mustard-backup` remote, avoiding a bucket-check operation not allowed by the token. This was an observed fix for this credential/setup, not a universal requirement for all R2 clients.
- **Manual recovery of that day's archive:** `2026-11-15_19-00.tar.gz`, 3,502,998,300 bytes, uploaded successfully after an initial transient `501 NotImplemented` and retry; remote file name/size confirmed.
- **Historical migration:** The seven earlier archives (Nov 8–14) were **copied**, not moved, from the historical media-bucket backup prefix to the new private bucket. `rclone` reported 22.762 GiB transferred; comparison of name/size listings reported no missing entries.
- **Limitations at the Nov 16 migration checkpoint:** Filename/size comparison did not establish SHA-256 equivalence or restore readiness. Source backup copies **were preserved through Nov 18** and were subsequently deleted on Nov 23 as recorded below.

### Scheduled backups and seven-day retention (Nov 17–18 JST)

- **Nov 17, 04:00 JST:** The cron-produced `2026-11-16_19-00.tar.gz` was present in the private bucket at **3,504,909,927 bytes**; a transient `501 NotImplemented` on the first attempt was followed by a successful second attempt. The local archive was absent after completion. This verified the **automatic** upload path rather than only manual recovery.
- **Nov 17 configuration:** After a read-only retention preview, `rclone delete mustard-backup:mustard-db-backups/backup/ --min-age 7d --include "*.tar.gz"` was restored immediately after the successful copy command. A pre-change script copy was preserved; `bash -n` passed. No deletion was invoked manually.
- **Nov 18, 04:00 JST:** The cron-produced `2026-11-17_19-00.tar.gz` was present at **3,509,560,816 bytes**; the first 501 again retried successfully.
- **First retention inventory:** The private bucket had **seven archives dated Nov 11–17**. The earlier Nov 8–10 archives were no longer listed after this scheduled run. This is consistent with the new seven-day, object-modtime-based rotation taking effect; the displayed log tail did not enumerate deletion operations.
- **Old-bucket inventory:** All seven historical backup originals from Nov 8–14 remained in the legacy nested path of the media bucket. No source archive was removed.

**Nov 18 handling decision:** Temporarily preserve these seven originals rather than deleting them during this maintenance pass. Migrated archive names and sizes were checked, but neither content hashes nor a full application restore were verified. The old location is a media bucket holding archives with sensitive configuration: public-read restrictions must not be inferred from a single HTTP HEAD result, and indefinite retention there should not be assumed safe. Any eventual retirement/access-control change is a separate, explicitly reviewed action.

### Legacy old-bucket backup archive retirement (Nov 23 JST)

After the new private R2 destination's daily upload and seven-day age-based retention were confirmed, the operator performed a **separate, narrowly scoped source cleanup** rather than adding any permanent cleanup timer to the media bucket.

- **Private backup listing immediately before deletion:** seven current daily archives, dated **Nov 16–22**, under `mustard-backup:mustard-db-backups/backup/`; latest archive `2026-11-22_19-00.tar.gz`, **3,529,008,644 bytes**. This verifies file presence, not full archive integrity or restoration.
- **Old media-bucket prefix:** seven historical archives dated **Nov 8–14**, listed under `mustard-media:mustard-obj-backup/mustard-obj-backup/backup/`. These were **older than seven days**, and all had already aged out of the private bucket's seven-day rotation. Removing them therefore **permanently discards those historical recovery points**, not merely a set of duplicate current backups.
- `rclone delete ... --min-age 7d --include "*.tar.gz" --dry-run -v` identified **exactly those seven archives**. The operator then compared the entire direct-file listing with an explicit seven-filename allowlist; the `diff` check passed with no changes.
- The operator invoked `rclone deletefile` once for **each of those seven exact object paths**, with seven `DELETED=` success lines, followed by a direct `rclone lsf ... --files-only` listing that printed **no remaining files**. The script exited at `STEP 40 COMPLETE` under `set -euo pipefail`.
- Combined original archive sizes corresponded to approximately **22.76 GiB** of objects removed from the historical backup prefix; no post-delete billed-storage measurement was made.
- **Scope:** Only the seven named archives in that legacy `backup/` prefix were targeted. No other legacy media path, normal-path media, current private-bucket backup, timer, or production service was changed.

**Outcome:** Old media-bucket DB backup originals **removed (Nov 23)**; the new isolated private backup destination and seven-day rotation remain the active policy. Archive encryption, file-level cryptographic integrity, and full application restore remain separately deferred checks, not implied by successful object management.

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

## 4. Checkpoints and remaining follow-up

| Date (JST) | Checkpoint | Result |
| --- | --- | --- |
| Nov 17 | Cron backup to new private bucket | **Confirmed**; retry from initial transient 501 |
| Nov 17 | Re-enable seven-day retention in `backup.sh` | **Configured and syntax-checked** |
| Nov 18 | Cron backup and first retention operation | **Observed**: seven Nov 11–17 archives; older copies absent in private bucket |
| Nov 18 | Original backups in old media bucket | **Seven retained temporarily**, no deletion |
| Nov 18 | Operational/handbook documentation | **Consolidation update**; no production changes |
| Nov 22 / review Nov 23 | First weekly remote-media cleanup and Healthchecks delivery | **Observed**: service success, 0 eligible objects; notifier logged `DELIVERED` (provider-side receipt unchecked) |
| Nov 23 | Legacy old-bucket backup originals | **7 explicit object deletes completed**, empty direct-file listing; old recovery points retired |

### Deferred, not prerequisites for this R2 cleanup

- Optional/longer-term improvement: encrypt production database backup archives (current private bucket and scoped tokens are access controls, **not** file encryption). This was discussed but **not scheduled or implemented**.
- A verified application-level production restore and per-file hash verification are distinct future exercises, not implied by successful upload or file-size checks.
- Existing Elasticsearch-only encrypted snapshot/restore work is separate from the application database backup; do not conflate their validation results.

## Publication and security boundaries

Public notes must exclude actual keys, full environment files, backup data, monitoring credentials, sensitive user media URLs, raw objects, and other recoverable secrets. The paths and service names shown here are descriptive evidence of the migration, not instructions to delete production data.
