# Korean Nori Search: Development and CI Validation (2026-10-25)

## Decision and scope

- **Date:** 2026-10-25 (JST)
- **Application:** Mustard Mastodon 4.7.3 source fork
- **Source repository:** [thanksstevenkim/mastodon-v2](https://github.com/thanksstevenkim/mastodon-v2)
- **Change:** Optional Korean morphological search support using the Elasticsearch Nori analyzer
- **Source status:** [PR #11](https://github.com/thanksstevenkim/mastodon-v2/pull/11) merged into `main` on 2026-10-25
- **Production status:** **Not deployed or enabled as part of this work.** The existing production search service and indexes were not replaced or reindexed.

This record documents an isolated language-analysis experiment, the feature-flagged Mastodon integration, and successful CI validation. It is a **pre-deployment engineering/operational record**, not a production rollout report or a completed runbook.

## Problem and motivation

The existing standard/content analyzers did not provide Korean morphological stemming for common inflected expressions. In a read-only production analyzer check, text such as `마스토돈에서 한국어 검색을 개선하고 싶어요` remained divided into word-like forms including `마스토돈에서` and `검색을`, which can fail to match users searching for `마스토돈` or `검색`.

The goal was to improve Korean term recall **without replacing the existing multilingual text fields or changing the semantics of quoted phrase, hashtag, and filter searches**.

## Isolated Nori experiment

The operator built a separate Elasticsearch **8.19.15** lab image with the `analysis-nori` plugin, and ran an isolated container with no external network and constrained CPU/memory. Production Elasticsearch was not modified for this experiment.

Comparisons used synthetic documents and separate test indexes, not a bulk copy of user content. The tested configuration used:

- `nori_tokenizer`, with `decompound_mode: mixed`;
- `nori_part_of_speech`, `nori_readingform`, and `lowercase` token filters;
- a small project-specific user dictionary for `겨자별` and `연합우주 연합 우주`;
- a supplemental `text.korean` field alongside the existing `text` and `text.stemmed` fields.

In the lab samples, ordinary searches for `마스토돈`, `검색`, and `겨자별` could find documents containing inflected forms that were missed by the legacy-only fields. The custom dictionary preserved `겨자별` and supported whole-word and component-word analysis of `연합우주`.

A wider match set is not automatically more relevant: for example, a search for `한국` may also match text containing `한국어`. Small synthetic English, Japanese, Chinese, and mixed-language examples did not reveal regressions in the tested queries, but they were **not** a comprehensive multilingual or ranking evaluation.

Quoted phrase behavior was deliberately left unchanged. Gap/slop experiments illustrated why enabling looser phrase matching could also admit unrelated intervening terms; no phrase-search change was included in the merged patch.

## Implementation

[PR #11 — feat(search): add experimental Korean search with Nori](https://github.com/thanksstevenkim/mastodon-v2/pull/11) introduced changes in:

- `app/chewy/statuses_index.rb`
- `app/chewy/public_statuses_index.rb`
- `app/lib/search_query_transformer.rb`
- `spec/lib/search_query_transformer_spec.rb`
- `spec/search/korean_search_integration_spec.rb`
- `.github/workflows/test-ruby.yml`

Both Chewy status indexes conditionally define the Nori analyzer, its tokenizer, and the `text.korean` multi-field when `ES_KOREAN_SEARCH_ENABLED=true`. The ordinary term-query transformer conditionally adds `text.korean` to the existing `multi_match` field list (`text`, `text.stemmed`) with `most_fields` and `operator: and`.

**The flag defaults to disabled** unless explicitly set to the string `true`. With the flag disabled or unset, the query fields remain `text` and `text.stemmed`, and the new analyzer/mapping additions are omitted. Hashtag, negative-term, quoted phrase, and filter-query behavior were not deliberately changed.

The flag affects both index definition and query construction. This is **not** a safe runtime switch to enable against existing production indexes: the plugin must be present and compatible, and the active indexes must be built with the matching mapping before queries use `text.korean`. A controlled indexing/transition procedure is required.

## CI verification

An independent `Nori-enabled Elasticsearch integration testing` job was added to Ruby Testing. It builds a temporary Elasticsearch 8.19.15 image with `analysis-nori`, starts an isolated Elasticsearch instance, verifies that the plugin is installed, and runs search specs with `ES_KOREAN_SEARCH_ENABLED=true`.

The integration specs cover both `StatusesIndex` and `PublicStatusesIndex`, checking actual Elasticsearch mapping creation, token analysis for the custom dictionary, and a Korean base-word query matching a synthetic inflected status. Existing standard search tests also run in the Nori-enabled job.

- **Post-merge Nori-enabled CI:** `23 examples, 0 failures`.
- **Post-merge Ruby Testing:** all **13 of 13** internal jobs passed, including Nori, regular search integration across supported Elasticsearch/OpenSearch configurations, Ruby-version matrix tests, E2E, and build tasks.
- **Post-merge main CI:** all **7 of 7** triggered workflows passed: Ruby Testing, Ruby Linting, CodeQL, Check formatting, Check i18n, Historical data migration test, and Chromatic.
- **RuboCop review:** The initial integration spec needed a narrowly documented `RSpec/DescribeClass` exception because it tests two index classes; lint passed after correction.
- **GitHub Actions security review:** The Nori job was restricted to `permissions: contents: read` following a CodeQL automated review; subsequent security and lint checks passed.

Evidence:

- [PR #11 and review history](https://github.com/thanksstevenkim/mastodon-v2/pull/11)
- [Post-merge Ruby Testing, including Nori job](https://github.com/thanksstevenkim/mastodon-v2/actions/runs/40176522692)
- [Post-merge Ruby Linting](https://github.com/thanksstevenkim/mastodon-v2/actions/runs/40176522655)
- [Post-merge CodeQL](https://github.com/thanksstevenkim/mastodon-v2/actions/runs/40176522697)
- Merge commit: [`80e506dfae61ebba972f5084787b33d6eab1dd5d`](https://github.com/thanksstevenkim/mastodon-v2/commit/80e506dfae61ebba972f5084787b33d6eab1dd5d)

After merging, the operator fast-forwarded the server-side source checkout at `~/mastodon-v2` to `main`; its `HEAD`, `origin/main`, and `origin/HEAD` resolved to `80e506dfae`. This updated the **source checkout only**, not the running Mastodon containers in `/opt/mastodon`.

## Deployment boundary and open risks

The following **have not yet been established** by the merged PR or its successful CI:

1. A Nori-enabled **production Elasticsearch image** has not been prepared and deployed to the live search container.
2. Existing production status/public-status search indexes have **not** been rebuilt with the new Korean mapping; no production reindex was performed.
3. No production cutover, rollback rehearsal, live-traffic verification, latency measurement, or index-size impact assessment has been completed.
4. The synthetic regression suite does not establish full Korean precision/recall, phrase behavior, relevancy tuning, or equivalence for every non-Korean language.
5. Disabling the feature flag is a query/configuration control; it does not by itself restore an index mapping after an in-place rebuild or safely roll back an Elasticsearch container image.

Do not set `ES_KOREAN_SEARCH_ENABLED=true` against legacy indexes and assume the new field is available. Keep the new feature disabled until the corresponding plugin, indexes, application configuration, and recovery plan are verified together.

## Next actions

1. Confirm a recoverable Elasticsearch snapshot/backup and document existing index names, mappings, document counts, and disk capacity **before** any production change.
2. Build and verify a version-matched Elasticsearch **8.19.15 + analysis-nori** production candidate image without replacing the running image.
3. Design a non-destructive reindex/migration strategy with explicit old-index retention, consistency checks, cutover criteria, and rollback steps. Account for index size, load, permissions, and ongoing writes.
4. Rehearse the change away from production, including mapping checks, sample searches, restart behavior, and rollback.
5. Schedule a separate production rollout and record its actual results, including health checks, user-visible search behavior, and any downtime or regressions.

## Lessons learned

- A language analyzer can improve Korean recall while introducing ranking/precision trade-offs; preserve legacy fields and evaluate both.
- A **default-off feature flag** protects compatibility but does not remove the need for matching index mappings and a controlled reindex.
- Isolated Elasticsearch experiments and a dedicated CI job are useful safeguards before touching the live search cluster.
- Distinguish **source merged and CI green** from **service deployed, indexed, and verified in production**.
- GitHub Actions credentials should have job-scoped minimum permissions; security review is part of integration readiness.

No credentials, environment secrets, production request logs, or private user content are included in this public record.
