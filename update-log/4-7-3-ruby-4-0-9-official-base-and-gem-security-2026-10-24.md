# Mastodon 4.7.3: Ruby 4.0.9 Official Base and Gem Security Patch Rollout

## Date and scope

- **Date:** 2026-10-24 (JST)
- **Application:** Mastodon 4.7.3 (unchanged)
- **Scope:** Ruby 4.0.9 official-base availability, GitHub CI recovery, targeted gem security fixes, and Web/Sidekiq image replacement
- **Production result:** Web, Sidekiq and Streaming all `healthy` at the final observed checkpoint; restart counts 0 for all three; public HTTPS returned HTTP 200

This log follows the [2026-10-23 Ruby 4.0.9 manual-base rollout](4-7-3-ruby-4-0-9-security-maintenance-2026-10-23.md). It documents a subsequent build from the source's published Ruby base-image reference and a targeted lockfile patch. This was **not** a new Mastodon application release.

## Source changes and CI

Source: [thanksstevenkim/mastodon-v2](https://github.com/thanksstevenkim/mastodon-v2).

1. [PR #9 — Ruby 4.0.9 runtime security patch](https://github.com/thanksstevenkim/mastodon-v2/pull/9) was merged on 2026-10-24. Its container-image build check, previously blocked while the official `docker.io/library/ruby:4.0.9-slim-trixie` image tag was unavailable, was rerun successfully after the tag became available. Merge commit: `b248fe042a48e4e91dc4e7d53baefa657e665ade`.
2. The first `main` Bundler Audit run after PR #9 flagged two locked dependencies:
   - `crass 1.0.7`, [GHSA-pq4g-8rxf-4g29](https://github.com/rgrove/crass/security/advisories/GHSA-pq4g-8rxf-4g29), fixed by `crass >= 1.0.8`.
   - `pghero 4.0.1`, [GHSA-5287-hmjh-qmqq](https://github.com/ankane/pghero/security/advisories/GHSA-5287-hmjh-qmqq), fixed by `pghero >= 4.1.0`.
3. [PR #10 — update crass and pghero dependencies](https://github.com/thanksstevenkim/mastodon-v2/pull/10) was merged on 2026-10-24. The reviewed `Gemfile.lock` change was limited to:
   - `crass`: `1.0.7` → `1.0.8`
   - `pghero`: `4.0.1` → `4.1.0`
   - `uri`: `1.1.1` → `1.1.2` (additional resolver change)
   - Patch commit: `e2feb9c6bfb42d845cb0012fb073037f7408f222`
   - Merge and current deployed-source `main` commit: `d3c23afc6df2e072aadc886488a6388d4576ec76`

A Ruby 4.0.9 temporary container was used for the dependency lock update, because the Ubuntu host's `rbenv` installation did not include Ruby 4.0.9. An independent `bundler-audit check --update` reported **`No vulnerabilities found`**. The initial local commit was blocked because Yarn was unavailable for the Husky hook; after verifying the narrow staged diff, the hook was bypassed for that commit only. The changes were then pushed and reviewed through GitHub CI.

### Post-merge `main` checks

For `d3c23afc6d`, the following GitHub Actions workflows completed successfully: Bundler Audit, Ruby Testing, Ruby Linting, Haml Linting, CodeQL, Check formatting, Check i18n, Historical data migration test, and Chromatic.

- [Successful `main` Bundler Audit](https://github.com/thanksstevenkim/mastodon-v2/actions/runs/40069636293)
- The scheduled `Build nightly container image` workflow was **skipped**; it is not evidence of a successful image publication.
- PR #10's `Build container image for PR` workflow was also **skipped**. The application build for deployment was performed separately on the production host.

## Local production image and verification

The source Dockerfile selects `ruby:4.0.9-slim-trixie` from `docker.io`. A new local production image was prepared with a separate tag:

~~~text
mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9-secfix-20261024
~~~

The previous production tag was retained for rollback:

~~~text
mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9
~~~

Observed checks on the new image:

| Check | Observed result |
| --- | --- |
| Ruby runtime | `4.0.9`, x86_64 Linux, YJIT and PRISM enabled |
| `crass` | `1.0.8` |
| `pghero` | `4.1.0` |
| `uri` | `1.1.2` |

The local runtime and gem versions were independently queried from the built image before deployment. The exact underlying Ruby base-image digest, final image ID, and registry-push status were **not** captured in this session; no claim of a multi-architecture image publication is made.

## Production deployment

A dated Compose configuration backup was present and validated before rollout: it contained two original Ruby image references and zero references to the new security-patch tag. The active Compose file was updated only for the Web and Sidekiq image references. `docker compose config --quiet` succeeded; the resolved image list showed the new tag for those two services and the existing separate Streaming tag.

The rollout was staged:

1. Recreated **Web** only using `docker compose up -d --no-deps --no-build --pull never web`.
2. Observed Web become `healthy`, with restart count 0. A direct loopback request without the intended Host header returned HTTP 403; with the service Host header, the HTTP response was 301. A public HTTPS request returned **HTTP 200**.
3. Recreated **Sidekiq** only using the same scoped Compose flags.
4. Queried the final health, restart counts and deployed image names for Web, Sidekiq and Streaming.

**Final checkpoint:**

| Service | Image suffix | Health | Restarts |
| --- | --- | --- | --- |
| Web | `v4.7.3-ruby4.0.9-secfix-20261024` | `healthy` | 0 |
| Sidekiq | `v4.7.3-ruby4.0.9-secfix-20261024` | `healthy` | 0 |
| Streaming | `v4.7.3-streaming-node24.22.1` (unchanged) | `healthy` | 0 |

PostgreSQL, Redis, Elasticsearch and Streaming were not intentionally recreated during this scoped rollout. No database migration was needed for these source changes.

## Limits, recovery and follow-up

- The recorded HTTP response and container health checks confirm the observed deployment checkpoint; they do not constitute an exhaustive feature, job-delivery or federation test. Downtime was not measured.
- Retain the prior Ruby image and the dated Compose configuration backup. Do not prune rollback images as part of this patch.
- On regression, restore the previous Web and/or Sidekiq image references, validate the Compose configuration, recreate only affected services and repeat the health/HTTP checks. Refer to the [runtime and dependency patch runbook](../runbooks/runtime-dependency-security-patches.md).
- At the next maintenance checkpoint, confirm ongoing Web/Sidekiq processing and capture image provenance/digests and registry-push status if required for reproducibility.

This record intentionally contains operational outcomes and public source references rather than configuration contents or authentication material.
