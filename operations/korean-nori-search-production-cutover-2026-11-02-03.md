# Korean Nori Search: Production Cutover and Admin Check Fix (2026-11-02–03)

## Outcome and scope

- **Service:** Mustard, Mastodon 4.7.4, Docker Compose, Elasticsearch 8.19.15 with Nori.
- **Cutover window:** 2026-11-02–03 (JST); follows staged work begun on 2026-10-25–26.
- **Outcome:** **Completed.** The production Web process used the Nori status-search indexes, served HTTP 200, passed its Elasticsearch system check, and the administrator confirmed that the previously persistent dashboard warning disappeared.
- **Deployment scope:** Web-only read routing and a subsequent Web-only administrator-check fix. No new index rebuild, deletion, backfill, or Sidekiq/Elasticsearch restart was required during these final deployments.
- **Evidence limit:** Verified routing, configuration, sampled search behavior, index definitions, and the administrator check; not a comprehensive search-quality or performance benchmark.

This is the production completion record for the earlier [Nori feature development and CI validation](korean-nori-search-development-and-ci-validation-2026-10-25.md) and [initial production staging checkpoint](production-maintenance-sidekiq-pghero-r2-nori-2026-10-25-26.md). Those documents correctly describe **earlier, incomplete states** and are retained as historical records.

## Starting point and safeguards

Prior stages had deployed an Elasticsearch 8.19.15 image with `analysis-nori`, created separate physical indexes `statuses_nori_v1` and `public_statuses_nori_v1`, enabled Sidekiq shadow synchronization, and completed the historical backfill and targeted repair processes. Recorded ACL samples covered 50 documents from each Nori index (100 samples total), with no observed authorization mismatch. This was sample-based validation, not proof of complete index equivalence.

The legacy `statuses` and `public_statuses` indexes were retained for rollback. Separate Elasticsearch snapshot/archive and isolated restore work had already been recorded in the [pre-Nori recovery report](elasticsearch-pre-nori-snapshot-r2-archive-and-disaster-recovery-2026-10-25.md). That recovery test applied to Elasticsearch search data, not to a full Mastodon service restore.

The source read-routing change was merged as [mastodon-v2 PR #16](https://github.com/thanksstevenkim/mastodon-v2/pull/16), merge commit [`ea1e5106a8`](https://github.com/thanksstevenkim/mastodon-v2/commit/ea1e5106a8fdf73aa197b9f488eb9090949dd8da). Its explicit cutover gate requires all three flags to be `true`:

- `ES_KOREAN_SEARCH_ENABLED`
- `ES_NORI_READ_ENABLED`
- `ES_NORI_READ_CUTOVER_ENABLED`

The last flag was supplied to Web during cutover. The staged Sidekiq writer and Elasticsearch service were left unchanged.

## First Web rollout, rollback, and RAID I/O wait

An initial Web-only attempt with the Nori-read image started the container, but Puma remained at application preloading; Web became `unhealthy` and the local HTTP health request did not succeed. Reverting to the previous Web image **did not immediately recover the service**: that image also encountered the same startup stall.

Read-only investigation found the Puma master in uninterruptible disk I/O wait (`D` state), with a kernel stack involving file reads through overlayfs/ext4. At the same time, `/dev/md3` was running a RAID1 consistency **check** (not a rebuild), with both members present (`[UU]`) and no failed devices reported.

The operator interrupted the ongoing RAID check by setting its `sync_action` to `idle`. Puma subsequently resumed startup and the previous Web image became `healthy` with HTTP 200. This sequence suggests that storage I/O contention contributed to the startup delay, but **does not conclusively prove the RAID check was the sole root cause**. The check was interrupted, not permanently disabled; rescheduling or tuning it remains separate operational maintenance.

The failed first attempt did not warrant rebuilding Nori indexes or repeating the completed backfill. The recovery boundary was the Web image/Compose override, with earlier images and dated override backups preserved.

## Successful Nori read cutover

With the Web service recovered and the RAID check idle, the operator reused the already-built image:

`mustardkim/mastodon-mustard:v4.7.4-ruby4.0.9-nori-read-7a718e3607`

The Web-only Compose recreation completed. After initialization, the container was `healthy` and the local health endpoint returned HTTP 200. A Rails runtime check reported:

```text
Nori read enabled: true
Search indices: public_statuses_nori_v1, statuses_nori_v1
=== NORI ROUTING VERIFIED ===
```

The search UI also returned results for a Korean-language query. That confirms a user-visible result path, not a measured improvement in recall, precision, ranking, or latency. The existing authorization design was preserved by the read-routing implementation; the sampled ACL checks are not an exhaustive authorization proof.

## Administrator warning: cause and correction

After the successful read cutover, the administrator dashboard continued warning about search-index configuration. Its original `Admin::SystemCheck::ElasticsearchCheck` compared the legacy `StatusesIndex` and `PublicStatusesIndex` definitions with the legacy physical indexes, even though Web searches were now routed to the Nori indexes.

A production read-only check reported both `statuses` and `public_statuses` as mismatches for mapping and Chewy specifications. When checked directly against the active Nori definitions, however, both Nori index **mappings matched**:

| Active physical index | Mapping comparison | Actual index settings comparison |
| --- | --- | --- |
| `statuses_nori_v1` | `true` | `PASS` |
| `public_statuses_nori_v1` | `true` | `PASS` |

For both Nori index classes, `specification.changed?` still returned `true`. Inspection of Chewy 8.4.1 showed that this method compares the current definition against a saved Chewy specification snapshot; it is **not a direct comparison to the live Elasticsearch index**. Therefore, the result alone did not establish a broken Nori index.

[mastodon-v2 PR #17](https://github.com/thanksstevenkim/mastodon-v2/pull/17) changed the administrator check to:

1. Select the active Nori physical index when the read cutover is enabled.
2. Compare its actual mappings and live Elasticsearch settings (including analysis settings) with the expected definition, rather than treating a stale specification snapshot as an index failure.
3. Keep the previous checks for non-Nori/legacy mode and other index classes.

The first PR lint attempt failed on RuboCop `Style/MultipleComparison` in a test. A small test-only change to use `Array#include?` resolved it. The subsequent Ruby lint, Ruby tests, CodeQL, formatting, i18n, and historical migration workflows passed. PR #17 was merged in commit [`301486bae647`](https://github.com/thanksstevenkim/mastodon-v2/commit/301486bae64781ebed576618020e8fdb281e03e6).

The final Web image was built and loaded successfully:

- **Image:** `mustardkim/mastodon-mustard:v4.7.4-ruby4.0.9-nori-admin-301486bae6`
- **Image ID:** `sha256:fedf8a07ed373ede5c9c7b5ce5bbe75f657fb43f2378f63d0dc4dc81915f2365`

Only the Web image tag in the existing Compose override was changed. A dated pre-update override backup was retained. The new Web container initialized successfully.

## Final production evidence

The final read-only Rails/system-check output was:

```text
Web: healthy
HTTP 200
Nori enabled: true
Mapping mismatches: []
Specification mismatches: []
Elasticsearch system check: PASS
=== FINAL CHECK COMPLETE ===
```

The operator then refreshed the Mastodon administrator dashboard and **confirmed that the warning disappeared**. This is a completed production cutover and admin-warning remediation, not merely a merged PR or a CI-only result.

## Remaining boundaries and lessons

- **Keep rollback assets:** Retain legacy physical indexes, the previous Web image reference, and the dated Compose override backup until a separate retention decision. Do not run `tootctl search deploy` merely to clear an administrator warning; it is not a harmless dashboard refresh.
- **Search quality:** No comprehensive Korean relevance, multilingual regression, production latency, or full ACL-parity benchmark is claimed. Revisit only if actual user-visible search problems arise.
- **RAID maintenance:** The periodic consistency check was interrupted during Web recovery. Investigate its future schedule and I/O throttling separately, during an appropriate maintenance window; the observed stall is evidence of an I/O-wait incident, not proof of a failed RAID member.
- **Remote media:** The separate R2 remote-media refetch process reached its completion marker and exit code 0, but its recorded custom-emoji failures (5,512) remain a distinct follow-up. They are not Nori index failures.
- **Scope discipline:** Do not repeat completed backfills, snapshot/restore rehearsals, or broad source audits solely because the dashboard previously displayed a false-positive index warning. Correct the diagnostic to reflect the active search path, while preserving meaningful checks against the live index.

This public record contains no credentials, request payloads, personal account identifiers, private index documents, or backup decryption details.
