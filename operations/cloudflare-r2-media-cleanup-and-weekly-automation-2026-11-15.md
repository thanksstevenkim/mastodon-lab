# Cloudflare R2 Media Maintenance and Weekly Cleanup Automation (2026-10-31–11-15)

## Scope and evidence boundary

- **Instance:** Mustard, production Mastodon, Docker Compose, Cloudflare R2.
- **Period:** 2026-10-31–2026-11-15 (JST).
- **Purpose:** Record the legacy object-path cleanup, targeted DB–R2 consistency checks, and recurring remote-cache maintenance, separately from Elasticsearch backup storage and Mastodon application upgrades.
- **Outcome at 2026-11-15:** Legacy cleanup across attachments, avatars, headers, custom emoji and preview cards was reported complete. The **preview-card batch** has a final success log with exact numbers. A targeted DB-to-R2 sample audit found one unavailable remote header. Weekly cleanup scheduling and notifier configuration were enabled; the first scheduled execution and actual Healthchecks delivery remained unverified.
- **Evidence boundary:** Script-reported deleted bytes are **estimates**, not independently verified reductions in billed R2 storage. Sample audits do **not** establish complete object integrity.

## Object-key layout and historical cleanup

The production bucket was `mustard-obj-backup`. After removal of the old path-style/bucket-nested layout, valid application media keys use paths such as:

```text
cache/preview_cards/images/...
```

The historical nested prefix had an extra bucket component:

```text
mustard-obj-backup/cache/preview_cards/images/...
```

Earlier cleanup covered legacy media attachments, account avatars and headers, and custom emojis. These operations were completed before the preview-card batch documented here. Previous recovery work addressed mixed old/new key layouts; do not assume all historically missing remote media were recoverable.

The preview-card cleanup reused the previously tested emoji cleanup's key-safety checks, current DB reference protection, object metadata comparisons and resumable checkpoints. The script:

1. Collected currently referenced `PreviewCard` image paths in a `Set`.
2. Listed only historical `mustard-obj-backup/cache/preview_cards/images/` keys.
3. Protected referenced paths, and skipped objects with changed metadata or mismatched current copies.
4. Deleted eligible **legacy keys only**; normal-path objects and DB rows were not targeted.
5. Logged each listing-page checkpoint and counts; retried transient R2 throttling/network failures.

A 100-object dry run reported 100 candidates, no mismatches, and no changes. The subsequent production deletion logged a transient HTTP 500 for one delete attempt followed by continued successful progress; it did not cause an observed batch failure.

### Final preview-card cleanup evidence

```text
PROGRESS scanned=191936 deleted=191936 db_protected=0 mismatch=0 changed=0 freed_gib=10.600
=== LEGACY PREVIEW CLEANUP COMPLETE ===
DELETED=191936
ESTIMATED_FREED_GIB=10.600
EXIT_CODE=0
```

- **191,936 legacy objects** were recorded as deleted, and the process exited successfully.
- **10.600 GiB** is the script's sum of deleted object sizes, not an independently measured billing reduction.
- `db_protected=0` means **none of the enumerated legacy objects** matched the DB-protected normal-path set during this run; it does not mean no images are referenced in the database.
- The initial protected path set had **5,223** entries. Database contents may change while a long-running cleanup is in progress.
- The script's successful delete response does not constitute a separate post-delete inventory of every individual object.

## Targeted database-to-R2 checks

Following the legacy cleanup, no full-bucket audit or mass recovery was triggered.

| Check | Tested keys | Missing |
| --- | ---: | ---: |
| Oldest/newest sample across media attachments, avatars, headers, emoji, preview cards | 71 | 0 |
| Date-window and historical-midpoint sample across the same categories | 327 | 1 |

The second sample found **one remote account header** still referenced by the database but absent from both its normal and historical R2 paths. The recorded remote media URL used HTTPS on an external media host, and an HTTP **HEAD** request returned **404**. The original bytes were not recovered; GET behavior and any alternate current remote header were not verified.

**Decision:** Defer intervention for that single remote cache item. Do not delete its account record, rerun all earlier recovery batches, or infer a root cause from the missing key alone. These checks establish only the tested sample's results.

## Normal-path remote attachment cleanup

The installed Mastodon `tootctl media remove --help` explicitly supports a dry run, interaction protection and bounded concurrency. The selected conservative policy is:

```sh
bin/tootctl media remove --days 30 --keep-interacted --concurrency 2
```

This targets old **remote post attachments** only. Avatar/header pruning and locally uploaded media are excluded. In the documented **dry run**:

```text
Removed 0 media attachments (approx. 0 Bytes) (DRY RUN)
```

Therefore no one-off real removal was needed for that checkpoint. The result is the command's eligibility decision, **not** proof that no older normal-path R2 objects exist.

## Weekly automation

- **Units:** `mustard-media-cache-cleanup.service` and `mustard-media-cache-cleanup.timer`.
- **Script:** `/home/ubuntu/mustard-media-cache-cleanup.sh`.
- **Schedule:** Saturday **19:00 UTC** = Sunday **04:00 JST**, first due 2026-11-22.
- **Policy:** 30-day retention, `--keep-interacted`, concurrency 2, no profile pruning.
- **Safety:** file lock plus detection of another running `tootctl media remove`; `Persistent=false` prevents immediate catch-up runs on boot; no container restart.
- **Logging:** `journalctl -u mustard-media-cache-cleanup.service`.
- **Monitoring:** dedicated Healthchecks credential and notifier, separated from Sidekiq's established audit notifier. A systemd `ExecStopPost` drop-in reports `SERVICE_RESULT=success` as success and other results via `/fail`. Notifier delivery problems do not overwrite the primary maintenance service result.

The timer was confirmed **enabled** and **active**. Dry-run notifier invocations returned the expected success/failure branches. **An actual heartbeat delivery and the first scheduled cleanup were not yet observed** at this checkpoint; monitor the first run rather than forcing a new destructive cleanup to validate notification.

## Cloudflare R2 dashboard snapshot

A Cloudflare R2 dashboard screenshot supplied by the operator on 2026-11-15 showed:

| Displayed bucket | Objects | Displayed size |
| --- | ---: | ---: |
| `mustard-obj-backup` | approximately 492.74k | 103.2 GB |
| `mustard-es-snapshots` | 2 | 1.48 GB |
| `mustard-es-snapshot-lab` | 18 | 16.82 kB |

The **Usage** panel showed **104.52 GB total storage**, **20.45k Class A operations**, **425.71k Class B operations**, and **$0.00 billable usage shown for the current period** (November 13–December 13). Bucket-row figures and the Usage total are dashboard displays at potentially different precision/refresh times; do not force their rounded figures to reconcile exactly. The $0.00 display is not a forecast of future charges.

**Do not interpret 103.2 GB as the pre-cleanup value or subtract 10.600 GiB again.** The screenshot is a current-state observation after the documented preview cleanup.

## Follow-up and operating boundaries

1. Observe the **first weekly timer execution** and actual Healthchecks delivery after 2026-11-22; until then scheduling and notifier branching are configured but production delivery is unverified.
2. Keep the single unrecovered remote header as a limited unresolved cache finding, not a service-wide loss diagnosis.
3. Treat any later broad DB–R2 consistency inventory or additional recovery as a separately justified task. Do not re-run successfully completed legacy deletion batches.
4. Treat Ubuntu package updates and the pending reboot/OS upgrade notice as **separate** maintenance, not a prerequisite to declaring this R2 cleanup batch complete.

This public record intentionally omits Healthchecks Ping URLs, credentials, affected remote account identifiers, user media paths, and raw storage object inventories.

## 2026-11-16 follow-up: retained objects and backup credential separation

A subsequent **read-only** inventory found 73,071 objects (14.601 GiB by rounded prefix sums) under the old nested media prefixes, excluding legacy backup archives. The remaining `media_attachments/` count (30,949) matched the prior attachment cleanup log's `no_copy=30867` plus `mismatch=82`; individual object identity was not exhaustively compared. A small DB/R2 sample confirmed three current local media records whose normal-path objects existed at matching sizes. The operator therefore **retained the legacy objects** and did not start another mass deletion or recovery batch.

The same operating period also included dedicated private database backup storage, scoped R2 credentials, and retirement of the historical broad administrator token. Automatic upload and retention follow-up were pending at this checkpoint.

For the evidence, the limited sample results, credential migration, and exact remaining tasks, see [2026-11-16 R2 backup isolation and credential rotation](cloudflare-r2-backup-isolation-and-credential-rotation-2026-11-16.md).

## 2026-11-23 review: first scheduled weekly run

Read-only inspection of systemd state and journal confirms that the **first production run occurred automatically** on **2026-11-22 04:00 JST** (Nov 21 19:00 UTC):

- `mustard-media-cache-cleanup.timer`: `LoadState=loaded`, `ActiveState=active`, `LastTriggerUSec=Sat 2026-11-21 19:00:00 UTC`.
- `mustard-media-cache-cleanup.service`: started Nov 21 19:00:00 UTC; `Result=success`, `ExecMainStatus=0`; main process exited 19:00:31 UTC.
- Tool result: `Removed 0 media attachments (approx. 0 Bytes)`, followed by `=== MEDIA CACHE CLEANUP COMPLETE ===`. This is a successful policy run with **zero eligible objects**, not a cleanup failure.
- Healthchecks notifier log (19:00:32 UTC): `Healthchecks success event: DELIVERED`. This verifies **the notifier reported successful delivery**, but is not an independently observed Healthchecks dashboard receipt.
- Next timer elapse: **2026-11-29 04:00 JST** (Nov 28 19:00 UTC).

**Decision:** Transition the timer to normal weekly operation without forcing another cleanup, repeating earlier legacy deletion batches, or changing retention policy. Only investigate if a later run/notification indicates a problem. The snapshot is a historical observation, not a live health guarantee.
