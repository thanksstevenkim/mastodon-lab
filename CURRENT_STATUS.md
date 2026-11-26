# Current Operations Status

> **Last documented checkpoint:** 2026-11-27 (JST).
>
> This is the latest **recorded decision and observed-result index**, not a live production dashboard. It covers R2 maintenance and the latest Nginx and Mastodon/Ruby security-patch checkpoints; silence about other workstreams does not prove their health or completion.

## Next checkpoint

**Weekly R2 media-cache maintenance is now in regular operation.** The next timer elapse recorded at the Nov 23 review is **2026-11-29, 04:00 JST**; no additional manual validation or duplicate cleanup is required unless an alert, failure, or configuration change makes it necessary. The external Healthchecks dashboard receipt has not been separately inspected.

## Workstream status

| Workstream | Latest recorded state | Boundary / next action |
| --- | --- | --- |
| Mastodon 4.7.6 + Ruby 4.0.10 security upgrade | **Deployed and verified Nov 19:** Web and Sidekiq healthy on new image; local health endpoint and public HTTPS 200; Nori enabled and no reported index mismatches | Technical deployment complete; source branch remote push and user-facing notice not confirmed; preserve rollback resources |
| Nginx USN-9182-1 security patch | **Installed Nov 22; verified Nov 27:** `nginx` / `nginx-common` installed and candidate `1.24.0-2ubuntu7.21`; running master binary hash matches installed binary; configuration passes, service active, public HTTPS health 200 | Installation actor unconfirmed; no manual update or restart needed; prior origin HTTP/2 decision unchanged, negotiation not retested |
| R2 media legacy cleanup | Historical media/preview-card batches completed | Do not rerun previously successful deletion batches |
| Residual nested-path media | **Preserved by decision**: 73,071 objects; 14.601 GiB based on rounded inventory | No broad removal or recovery without specific grounds |
| DB–R2 consistency | Limited samples only; one remote account header still unrecovered | No full integrity claim or automatic remedial batch |
| DB backup isolation | **Completed**: private `mustard-db-backups` with scoped credentials; seven historical archives copied | Name/size comparisons only; full restore/hash checks not completed |
| Scheduled DB backup | **Private-bucket daily archives through Nov 23 confirmed by Nov 23 listing** (Nov 16–22 UTC archive dates) | Seven current archives listed; no full restore/hash validation |
| Seven-day DB backup retention | **Configured Nov 17; rotation observed Nov 18 and Nov 23** | Seven daily archives dated Nov 16–22 in Nov 23 listing |
| R2 credential scope | Dedicated media/backup tokens installed; historical broad administrator token revoked | No repeat rotation needed absent new evidence |
| Historical backup originals in media bucket | **Seven Nov 8–14 archives explicitly deleted Nov 23**; post-delete file listing empty | Old recovery points no longer available; no change to preserved media objects |
| Weekly remote-media cache cleanup | **First automatic run succeeded Nov 22**; 0 eligible media removed; Healthchecks notifier logged `DELIVERED` | Normal weekly operation; next scheduled Nov 29 04:00 JST; provider-side receipt not independently checked |
| Operational documentation | Nov 27 Nginx post-update verification recorded in mastodon-lab; prior handbook consolidation retained | Continue only when actual state/decision changes |

## Mastodon 4.7.6 / Ruby 4.0.10 checkpoint (Nov 19)

- From local branch `upgrade-4.7.6`, official `v4.7.6` was merged into the customized source at commit `5bdc0290c0`; the only merge conflict was the Ruby version line in `Gemfile.lock`. The Ruby 4.0.10 version references and retained Nori source files were checked. Source branch remote push has not been confirmed.
- One Docker image build completed: `mustardkim/mastodon-mustard:v4.7.6-ruby4.0.10-5bdc0290c0`. The effective Compose override was backed up and its two Web/Sidekiq image references updated. A scoped `docker compose up -d --no-deps --no-build --pull never web sidekiq` replaced those containers.
- Final observed checks: both `healthy`; local `/health` OK; public HTTPS 200; Rails Mastodon `4.7.6`, Ruby `4.0.10`; `NoriSearch::ReadIndexes.enabled?` true; admin Elasticsearch index mismatch list `[]`. This was a scoped post-deployment check, not an exhaustive application regression audit. No new DB migration, reindex, or unrelated service restart was performed.
- See [full upgrade log](update-log/4-7-6-ruby-4-0-10-security-upgrade-2026-11-19.md).

## Nginx USN-9182-1 checkpoint (Nov 27)

- Ubuntu [USN-9182-1](https://ubuntu.com/security/notices/USN-9182-1), published Nov 20, identifies `1.24.0-2ubuntu7.21` as the fixed Nginx version for Ubuntu 24.04.
- Dpkg logs show both packages upgraded from `7.20` to `7.21` on Nov 22 at 06:18:50 and 06:18:53 (server log time; timezone and installation actor not independently verified).
- Nov 27: installed and candidate versions match; APT simulation reports zero upgrades, installs or removals; `nginx -t` passed, service active, running master executable SHA-256 equals installed binary, and public HTTPS `/health` returned 200.
- No package installation, restart, reload or configuration change during this review. Prior origin HTTP/2 decision retained; origin negotiation not retested. No further immediate action. See [verification log](update-log/nginx-usn-9182-1-post-update-verification-2026-11-27.md).

## Nginx security-patch checkpoint (Nov 19; historical)

- Ubuntu advisory [USN-9159-1](https://ubuntu.com/security/notices/USN-9159-1) identifies `1.24.0-2ubuntu7.20` as a fix for Ubuntu 24.04. Before official package availability, both origin HTTP/2 listen options were disabled; subsequent local-origin and public HTTPS probes returned 200.
- APT simulated and then installed **only** `nginx` and `nginx-common` (`1.24.0-2ubuntu7.19` → `1.24.0-2ubuntu7.20`). Final observed `nginx -t` passed, the service was `active`, the master executable was `/usr/sbin/nginx`, the origin negotiated HTTP/1.1 and the public endpoint negotiated HTTP/2, both with HTTP 200.
- This is an observed post-update checkpoint, not continuous proof of service health or an exhaustive audit. The temporary Nginx patch-watch automation was paused. See [full update log](update-log/nginx-usn-9159-1-security-patch-2026-11-19.md).

## First weekly remote-media cache cleanup (reviewed Nov 23)

- Scheduled timer triggered **Nov 21 at 19:00 UTC = Nov 22 at 04:00 JST**. Timer showed `ActiveState=active`; service returned `Result=success`, `ExecMainStatus=0`, main process finishing at 19:00:31 UTC.
- Script reported `Removed 0 media attachments (approx. 0 Bytes)` and `MEDIA CACHE CLEANUP COMPLETE`. Zero removals reflect **no eligible candidates under the configured policy**, not an error.
- Notifier emitted `Healthchecks success event: DELIVERED` (19:00:32 UTC). This is a **server-side reported delivery**, not independent confirmation from the Healthchecks web dashboard.
- Next timer execution displayed **Nov 28, 19:00 UTC = Nov 29, 04:00 JST**. No forced manual rerun, extra deletion, or server configuration change was undertaken.
- Detailed record: [Cloudflare R2 media cleanup and weekly automation](operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md).

## Evidence: scheduled database backup and rotation

- **Nov 17 (04:00 JST):** New private-bucket archive `2026-11-16_19-00.tar.gz`, **3,504,909,927 bytes**, listed after cron. Log showed initial 501 response followed by successful retry; the local archive had been cleaned.
- **Nov 17:** After a successful automatic backup, restored the seven-day `rclone delete --min-age 7d` line in `backup.sh` following the upload command. A pre-change script copy was kept and `bash -n` passed; this step did not execute a manual deletion.
- **Nov 18 (04:00 JST):** New archive `2026-11-17_19-00.tar.gz`, **3,509,560,816 bytes**, listed after cron; initial 501 retried successfully. New private bucket listed **seven archives dated Nov 11–17**, with the earlier Nov 8–10 archives no longer present; consistent with active age-based retention.
- **Old media bucket at Nov 18:** All seven backup originals dated Nov 8–14 still listed and were temporarily preserved. **Nov 23:** Exact-file listing/dry-run identified those seven originals; an exact allowlist comparison passed, seven `deletefile` calls succeeded, and the subsequent direct-file listing was empty. This retires the earlier historical recovery points.
- File existence and names/sizes do **not** establish file hashes, database readability, or a full service restore. This status is a recorded checkpoint, not a guarantee of continued cron success after Nov 18.

## Nov 23 legacy backup retirement checkpoint

- The private `mustard-db-backups/backup/` prefix listed **seven archives dated Nov 16–22** (latest `2026-11-22_19-00.tar.gz`, 3,529,008,644 bytes) under the active seven-day rotation.
- The old media-bucket nested `backup/` prefix still listed **seven Nov 8–14 archives**. A dry run reported all seven as older than seven days.
- The operator used an exact seven-filename allowlist and verified it against the direct-file inventory; the diff check passed. Then all seven individual `rclone deletefile` calls succeeded, with a final direct-file listing showing **no files**. No live media or other legacy prefix was touched.
- These removed archives had **already aged out of the new private bucket**, so the older recovery dates have been **retired**, not merely deduplicated. The estimated removed archive size was **22.76 GiB**, not a separately measured billing reduction.
- Detailed evidence and scope: [R2 backup isolation and old-bucket archive retirement](operations/cloudflare-r2-backup-isolation-and-credential-rotation-2026-11-16.md).

## Preserved decisions and limitations

- Do **not** delete the remaining old-path media merely to reach zero residual objects. The 30,949 retained attachment objects align numerically with `no_copy=30,867` + `mismatch=82` from prior logs; identities were not exhaustively reconciled.
- Do **not** treat a few DB/R2 samples as a full integrity check. An unavailable remote header is a separate, limited cache finding.
- The old media-bucket nested `backup/` prefix's **seven historical DB archives were removed Nov 23** (approximately 22.76 GiB of listed objects). No claim is made about historical external access or deletion of any other copies of those files; the remaining DB archives in the separate private backup bucket are still unencrypted.
- Production DB archive encryption and complete application restoration remain **deferred**, not required to declare this R2 migration/rotation phase operationally complete.
- Do not conflate Elasticsearch encrypted snapshots with application DB backups. No unrelated production services, R2 objects, or existing historical logs were changed by the Nov 18 documentation update.

## Source records

- [Nginx USN-9182-1 post-update verification, Nov 27](update-log/nginx-usn-9182-1-post-update-verification-2026-11-27.md)
- [Mastodon 4.7.6 / Ruby 4.0.10 security upgrade, Nov 19](update-log/4-7-6-ruby-4-0-10-security-upgrade-2026-11-19.md)
- [Nginx USN-9159-1 security update and verification, Nov 19](update-log/nginx-usn-9159-1-security-patch-2026-11-19.md)
- [R2 media cleanup and weekly maintenance, Oct 31–Nov 15](operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md)
- [R2 backup isolation, scoped tokens, legacy object review, Nov 15–18](operations/cloudflare-r2-backup-isolation-and-credential-rotation-2026-11-16.md)

## How to maintain this page

Update only for a meaningful decision, observed execution, or next checkpoint. Keep detailed evidence in linked records. Differentiate **configured**, **manually observed**, **automatically executed**, and **still unknown**; do not publish live secrets, user-media paths, raw backups, or monitoring credentials.
