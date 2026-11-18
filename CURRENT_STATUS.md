# Current Operations Status

> **Last documented checkpoint:** 2026-11-18 (JST).
>
> This is the latest **recorded decision and observed-result index**, not a live production dashboard. It covers the R2 maintenance workstream; silence about other workstreams does not prove their health or completion.

## Next checkpoint

**2026-11-23, 09:30 JST:** Inspect the **first scheduled** `mustard-media-cache-cleanup.timer` execution (due Nov 22, 04:00 JST) and actual Healthchecks delivery. Do not force a duplicate deletion to verify monitoring.

## Workstream status

| Workstream | State at Nov 18 checkpoint | Boundary / next action |
| --- | --- | --- |
| R2 media legacy cleanup | Historical media/preview-card batches completed | Do not rerun previously successful deletion batches |
| Residual nested-path media | **Preserved by decision**: 73,071 objects; 14.601 GiB based on rounded inventory | No broad removal or recovery without specific grounds |
| DB–R2 consistency | Limited samples only; one remote account header still unrecovered | No full integrity claim or automatic remedial batch |
| DB backup isolation | **Completed**: private `mustard-db-backups` with scoped credentials; seven historical archives copied | Name/size comparisons only; full restore/hash checks not completed |
| Scheduled DB backup | **Nov 17 and Nov 18 automatic archives confirmed** in the private bucket | Earlier 403 fixed; intermittent initial 501s succeeded on retries |
| Seven-day DB backup retention | **Configured Nov 17; observed Nov 18** | Private bucket contained seven archives, Nov 11–17; older Nov 8–10 no longer present |
| R2 credential scope | Dedicated media/backup tokens installed; historical broad administrator token revoked | No repeat rotation needed absent new evidence |
| Historical backup originals in media bucket | **Seven Nov 8–14 archives retained temporarily** by Nov 18 decision | Confidentiality/access risk and safe retirement require a separate decision; no deletion yet |
| Weekly remote-media cache cleanup | Timer configured, first live run not yet observed | Inspect Nov 22 execution on Nov 23 |
| Operational documentation | Nov 18 record consolidation applied to mastodon-lab and handbook | Continue only when actual state/decision changes |

## Evidence: scheduled database backup and rotation

- **Nov 17 (04:00 JST):** New private-bucket archive `2026-11-16_19-00.tar.gz`, **3,504,909,927 bytes**, listed after cron. Log showed initial 501 response followed by successful retry; the local archive had been cleaned.
- **Nov 17:** After a successful automatic backup, restored the seven-day `rclone delete --min-age 7d` line in `backup.sh` following the upload command. A pre-change script copy was kept and `bash -n` passed; this step did not execute a manual deletion.
- **Nov 18 (04:00 JST):** New archive `2026-11-17_19-00.tar.gz`, **3,509,560,816 bytes**, listed after cron; initial 501 retried successfully. New private bucket listed **seven archives dated Nov 11–17**, with the earlier Nov 8–10 archives no longer present; consistent with active age-based retention.
- **Old media bucket:** All seven backup originals dated Nov 8–14 still listed. No original source deletion.
- File existence and names/sizes do **not** establish file hashes, database readability, or a full service restore. This status is a recorded checkpoint, not a guarantee of continued cron success after Nov 18.

## Preserved decisions and limitations

- Do **not** delete the remaining old-path media merely to reach zero residual objects. The 30,949 retained attachment objects align numerically with `no_copy=30,867` + `mismatch=82` from prior logs; identities were not exhaustively reconciled.
- Do **not** treat a few DB/R2 samples as a full integrity check. An unavailable remote header is a separate, limited cache finding.
- The old media bucket still contains **sensitive, unencrypted backup archives**. Temporary retention is a data-preservation choice, **not** a determination that public access is impossible or that indefinite storage there is prudent.
- Production DB archive encryption and complete application restoration remain **deferred**, not required to declare this R2 migration/rotation phase operationally complete.
- Do not conflate Elasticsearch encrypted snapshots with application DB backups. No unrelated production services, R2 objects, or existing historical logs were changed by the Nov 18 documentation update.

## Source records

- [R2 media cleanup and weekly maintenance, Oct 31–Nov 15](operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md)
- [R2 backup isolation, scoped tokens, legacy object review, Nov 15–18](operations/cloudflare-r2-backup-isolation-and-credential-rotation-2026-11-16.md)

## How to maintain this page

Update only for a meaningful decision, observed execution, or next checkpoint. Keep detailed evidence in linked records. Differentiate **configured**, **manually observed**, **automatically executed**, and **still unknown**; do not publish live secrets, user-media paths, raw backups, or monitoring credentials.
