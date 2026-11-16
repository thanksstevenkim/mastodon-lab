# Current Operations Status

> **Last documented checkpoint:** 2026-11-16 (JST).
>
> This is a short handoff index of **recorded decisions and pending actions**, not live production health monitoring. The entries below summarize the linked operation notes and have not been reverified against the running server. Coverage currently focuses on R2 maintenance; an unlisted workstream should not be assumed complete.

## Next checkpoint

**2026-11-17, 09:30 JST:** Check whether the 04:00 scheduled database backup completed successfully and whether its archive exists in the private backup bucket. **Only after that check passes**, consider restoring seven-day retention for the new destination.

## Workstream status

| Workstream | State at checkpoint | Next action / boundary |
| --- | --- | --- |
| Legacy R2 media and preview-card cleanup | Completed batches documented through Nov 16 | Do not repeat successful deletion batches |
| Residual old-path media | **Preserved by decision**: 73,071 objects (14.601 GiB by rounded inventory sums) | No broad deletion or recovery; require specific justification |
| DB–R2 consistency | Limited samples completed; one remote header not recovered | Full consistency audit not performed; targeted issue deferred |
| Database backup isolation | Private backup destination configured; 7 prior archives copied; one new archive uploaded manually | Verify the **next automatic** cron backup |
| R2 credential scope | Media and backup access separated; historical broad media token revoked | No re-rotation required without new evidence |
| Seven-day backup retention | **Disabled intentionally** during migration | Review only if automatic backup is confirmed |
| Old-bucket backup originals | **Retained intentionally** | Make a separate retention/removal decision |
| Weekly remote-media cache cleanup | Timer enabled; first scheduled run and production Healthchecks delivery unverified | Observe first run on Nov 22; review Nov 23 |
| Operational documentation | Nov 16 field notes recorded | Consolidation review scheduled for Nov 18 |

## Scheduled follow-ups (JST)

| When | Checkpoint | Condition |
| --- | --- | --- |
| Nov 17, 09:30–10:00 | Verify scheduled database backup in the private R2 bucket | Check cron outcome and archive; not manual upload alone |
| Nov 17, 10:00–10:30 | Review restoring seven-day backup retention | **Only if** the automated backup succeeded |
| Nov 18, 14:30–15:00 | Decide whether to keep the backup originals in the old bucket | No deletion before a separate safety decision |
| Nov 18, 15:15–16:00 | Consolidate the operations/handbook records | Keep evidence boundaries and open conditions |
| Nov 23, 09:30–10:00 | Review first weekly media cleanup and Healthchecks result | First timer run due Nov 22, 04:00; do not force a duplicate cleanup |

Scheduled times reflect the **Nov 16 documented plan**, not a live calendar check or proof of execution.

## Preserved decisions and limitations

- Do **not** rerun completed legacy media deletion batches. The 30,949 old-path attachment objects remaining in the Nov 16 inventory align in count with `no_copy=30,867` plus `mismatch=82`, but individual identities were **not** exhaustively established. These are preservation signals, not deletion authorization.
- The media integrity checks were **samples**, not a full DB–R2 audit. A missing remote account header remains deferred; do not treat it as a diagnosis of general service-wide data loss.
- Copied backup archive names and sizes matched; this does **not** establish cryptographic equivalence or restore readiness. Existing backup originals were not deleted.
- The production database backup archives remain **unencrypted**. Private bucket access and scoped credentials are not archive encryption. Encryption, full restore validation, and per-file hash verification are **separate, unscheduled work** rather than prerequisites retroactively added to the completed media cleanup.
- A successful **manual** upload after a failed Nov 16 scheduled run is not evidence that the next scheduled cron run succeeds.
- Do not mix R2 maintenance status with Elasticsearch snapshot recovery or unrelated host upgrades.

## Source records

- [Cloudflare R2 media maintenance and weekly cleanup automation (Oct 31–Nov 15)](operations/cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md)
- [Cloudflare R2 backup isolation, credential rotation, and legacy object review (Nov 15–16)](operations/cloudflare-r2-backup-isolation-and-credential-rotation-2026-11-16.md)

## How to maintain this page

Update this page **only when a meaningful workstream state, decision, or next checkpoint changes**. Record the date and cite the relevant operation/incident/update log; keep detailed evidence in those source documents. Distinguish planned actions, manually verified actions, and observed automatic executions. Never publish tokens, secrets, user-media paths, raw backups, or live security-control values.
