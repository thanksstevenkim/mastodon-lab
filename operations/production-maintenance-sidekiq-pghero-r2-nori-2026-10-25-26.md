# Production Maintenance: Sidekiq, PgHero, R2 Media, and Korean Nori Search (2026-10-25–26)

## Scope and status

- **Instance:** Mustard, Mastodon 4.7.3, Docker Compose.
- **Period:** 2026-10-25–26 (JST).
- **Purpose:** Consolidate changes made during a concentrated maintenance window without duplicating detailed investigation and recovery records.
- **Status at the 2026-10-26 checkpoint:** Sidekiq audit/alerting and the Featured Tag optimization were deployed; the Nori-capable Mastodon and Elasticsearch images, two new Nori index mappings, and shadow writes were active. **Nori historical backfill and remote-media recovery were still in progress. Nori search reads had not been switched over.**
- **Evidence boundary:** Container health, plugin/mapping checks and CI results are recorded as observed. This is not a claim of completed Nori search cutover, full index parity, completed media restoration, or measured post-deployment query improvement.

## Summary by workstream

| Workstream | Change or outcome | Status |
| --- | --- | --- |
| Sidekiq | Investigated federation delivery retries; installed read-only daily systemd audit and Healthchecks.io reporting, with email and Matrix/Element X notification channels tested | Implemented; first scheduled audit succeeded; first scheduled external heartbeat after notifier rollout still pending at the documented checkpoint |
| PgHero / Featured Tag | Investigated a costly query in `FeaturedTag#reset_data`; skip the `pick(:created_at)` lookup when `statuses_count` is zero | Source CI passed; included in the new production Web/Sidekiq image |
| R2 remote media | Cleaned up remote media/profile cache and initiated recovery of affected remote media objects | Recovery in progress; some remote images/custom emoji may remain unavailable |
| Elasticsearch recovery | Created and verified a pre-Nori filesystem snapshot; encrypted and archived a recovery copy to R2, downloaded it again, and verified restoration in an isolated Elasticsearch cluster | Completed as a point-in-time search-index recovery test; separate from remote media caching |
| Korean Nori search | Deployed matching Nori-capable images, created independent Korean-mapped indexes and enabled shadow synchronization | Historical backfill in progress; live search continues reading legacy indexes |
| Korean Mastodon handbook | Authored and refined Korean beginner-oriented installation and operations documentation; conducted lab installation and recovery exercises | Separate documentation project; keep learning procedures separate from production incident history |

## Sidekiq: investigate, observe, and notify

The investigation distinguished **remote ActivityPub delivery retries** from a stalled local queue. The observed ordinary queues were empty at sampled checkpoints even while the Retry set contained federation deliveries failing with remote HTTP responses, timeouts and circuit-breaker errors. No mass retry, Redis purge or destructive queue cleanup was performed.

A daily read-only audit was deployed using `mustard-sidekiq-audit.service` and `mustard-sidekiq-audit.timer`, scheduled at **01:30 UTC**. The first timer-triggered audit succeeded on **2026-10-26 01:30:29 UTC**. External reporting to Healthchecks.io was added; email and Matrix/Element X notifications were tested with separate checks, and a manual production audit successfully reported a normal heartbeat. The next scheduled production heartbeat after rollout had not yet been verified in the detailed record.

The audit monitors container health, queue size/latency, retry/dead counts and recent processing totals; it **does not automatically delete jobs or restart containers**.

Details: [Sidekiq delivery retries and daily audit](sidekiq-delivery-retries-and-daily-audit-2026-10-26.md). This investigation is distinct from the [earlier pull-queue backlog after account deletion](../incidents/012-sidekiq-pull-queue-backlog-after-account-deletion.md).

## PgHero and Featured Tag query optimization

PgHero and production source inspection identified the `FeaturedTag#reset_data` method as a repeated-query path. The code counted visible tagged statuses and then queried `created_at` again even when the count was zero. During investigation, **379 of 484** inspected remote featured-tag records had zero statuses; this observation helped prioritize the empty-result path.

The one-line change in `app/models/featured_tag.rb` preserves the count query but skips the second lookup when there are no statuses:

```ruby
self.last_status_at = statuses_count.positive? ? visible_tagged_account_statuses.pick(:created_at) : nil
```

It was developed separately, then integrated into the Nori deployment branch in commit `65ba700dc4`. The combined GitHub CI passed. The integrated application image was deployed to **Web and Sidekiq** on 2026-10-26; both containers reported `healthy`. Streaming remained on its existing image. **An observed reduction in production query latency after rollout has not yet been established in this record.**

The prior Ruby 4.0.9 / `crass` / `pghero` dependency security maintenance was a separate, already completed upgrade: [2026-10-24 runtime and gem security rollout](../update-log/4-7-3-ruby-4-0-9-official-base-and-gem-security-2026-10-24.md).

## Cloudflare R2: distinguish media cleanup from search backups

### Remote-media cache maintenance and recovery

The remote-media storage maintenance investigated Mastodon's media/profile cleanup behavior and a separate R2 object-listing problem. ListObjects responses were initially empty/incomplete; an S3 endpoint configuration containing a bucket path was corrected, after which list/head operations succeeded. A profile-pruning dry run identified substantial potential cleanup volume; a production media cleanup operation was then run.

During subsequent recovery, **some federated images, videos, avatars and custom emoji could be temporarily missing or not displayed**. Restoration of media objects from retained copies was undertaken using a resumable server-side process. At this checkpoint, that recovery was still ongoing; neither complete coverage nor a final cache-purge outcome is claimed. User-facing communication should describe the impact and the ongoing recovery without promising a precise completion time.

**This remote-media operation is not the Elasticsearch snapshot R2 archive.** It should not be treated as a search-index restore or evidence that all historical media are recoverable. Do not publish live credentials, object inventories or user media in a public operational report.

### Search-index disaster recovery archive

Separately, an Elasticsearch filesystem snapshot of six ordinary indexes and 14 primary shards was encrypted and archived to R2. The remote archive was downloaded, its checksum checked, decrypted, and restored in a network-isolated Elasticsearch 8.19.15 container. All six restored indexes and their basic search checks passed. Direct use of R2 as an Elasticsearch S3 snapshot repository was **not adopted** after Repository Analysis failed; a filesystem repository plus encrypted off-site archive was selected instead.

Details: [Elasticsearch snapshot, R2 archive and verified recovery](elasticsearch-pre-nori-snapshot-r2-archive-and-disaster-recovery-2026-10-25.md).

## Nori: exact production deployment boundary

The original optional Nori analyzer implementation was merged separately as [PR #11](https://github.com/thanksstevenkim/mastodon-v2/pull/11) on 2026-10-25. On 2026-10-26, [Draft PR #12](https://github.com/thanksstevenkim/mastodon-v2/pull/12) carried additional Nori shadow synchronization, backfill/checkpoint and conditional read-routing code plus the Featured Tag optimization. Its integrated **source commit** was `65ba700dc4fff1c2bcaa857af8cd2d725fe711af`; the relevant GitHub Actions workflows, including Nori-enabled Elasticsearch integration testing, passed. **PR #12 remained draft/unmerged at the checkpoint even though its image had been built and locally deployed.**

The combined Mastodon image was built and loaded on the production host:

```text
mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9-secfix-nori-featured-20261026
```

Its image source commit matched `65ba700dc4` and Ruby reported `4.0.9`. Web and Sidekiq were recreated with the new tag and became `healthy`; Streaming kept its separate Node 24 image. Previous image references and dated Compose backups were retained.

The single-node Elasticsearch service was kept on **8.19.15**, but its image was replaced with a locally built image containing the `analysis-nori` plugin:

```text
mustard-es-nori:8.19.15-20261026
```

Its existing data bind mount was preserved. After the Elasticsearch-only recreation, the node reported `healthy`, the plugin was listed, the cluster was `green` with one node, and the old `statuses` and `public_statuses` indices still existed.

Two **new, independent** physical indices were then created, without dropping or rebuilding the legacy ones:

- `statuses_nori_v1`
- `public_statuses_nori_v1`

Both were verified to have a `text.korean` mapping using the `korean` analyzer. Production Web and Sidekiq received `ES_KOREAN_SEARCH_ENABLED=true` and `ES_NORI_SHADOW_WRITES_ENABLED=true`. Runtime checks showed shadow writes **enabled** and Nori reads **disabled** on both services. `ES_NORI_READ_ENABLED` was not enabled. `ES_NORI_BACKFILL_ENABLED=true` was supplied only to one-off backfill processes, not installed as a permanently enabled production environment setting.

Backfill began with **100 records per index** and a Redis-backed checkpoint. A detached, resumable process subsequently continued the two sequential backfills in batches of 100 with short pauses. A progress sample showed **25,000 processed public-status rows in 7 minutes 45 seconds**. For scale, the then-current legacy Elasticsearch document counts were **1,866,307 public statuses** and **455,230 private/searchable statuses**; these counts are *not* a definitive total of backfill source rows or a verified parity measure.

Disk headroom at the checkpoint was approximately **3.2 TB free** on the volume containing Elasticsearch data. The standalone direct `curl` inspection failed with HTTP 401 because the authenticated Elasticsearch API does not accept unauthenticated requests; that error did not indicate an Elasticsearch outage. Authenticated Rails/Chewy queries were used for subsequent index inspection.

**Remaining Nori steps:** allow both backfills to complete, verify checkpoints and index state, perform limited representative Korean queries and public/private access checks, explicitly enable Nori reads only after those checks, and retain legacy indexes for rollback. Avoid describing CI success, index creation, or a backfill progress log as proof that production search cutover is complete.

Related historical engineering record: [Nori development and CI validation](korean-nori-search-development-and-ci-validation-2026-10-25.md). That earlier document describes the *pre-deployment* state at the time it was written; this report records later production changes.

## Korean handbook and documentation boundary

The independently maintained [Korean Mastodon handbook](https://github.com/thanksstevenkim/mastodon-ko-handbook) contains beginner-oriented installation and operations material developed alongside Ubuntu/UTM installation and disaster-recovery exercises. Its **Getting Started** content should emphasize the actual steps a new operator needs, without interleaving extensive validation transcripts or attempting to document every failure scenario.

This `mastodon-lab` repository remains the source for production observations, investigative evidence, incident lessons and operational decisions. Detailed lab/DR experiments may be preserved separately; they need not expand the basic handbook into a second general Mastodon documentation project. Handbook restructuring and merging were separate editorial tasks, not a claim that Nori production rollout or remote-media restoration had completed.

## Open items at this checkpoint

1. **R2 remote media:** finish the ongoing restoration, verify representative remote media/custom emoji, and publish a completion notice only when supported by results.
2. **Nori:** finish both backfills and their checks, then deliberately enable Nori reads and confirm Korean search and access controls; retain the legacy path for rollback.
3. **Documentation:** update the Nori draft PR description and final operating record after cutover; keep the beginner handbook separate.
4. **Monitoring:** confirm the first *scheduled* production Healthchecks heartbeat following notifier installation at the next scheduled run.

This record intentionally omits tokens, passwords, raw user content, individual remote inboxes and private backup object identifiers.
