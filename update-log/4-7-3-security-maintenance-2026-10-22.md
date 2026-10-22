# Mastodon 4.7.3 Runtime and Dependency Security Maintenance

## Date

2026-10-22 (Japan Standard Time)

## Scope and outcome

This is a **post-4.7.3 security maintenance record**, not an upgrade to a new Mastodon application release. It supplements [the 4.7.3 upgrade log](4-7-3.md).

The maintenance addressed the Ruby runtime and vulnerable locked gems, repaired CI's Ruby installer pin, applied a separate Node.js streaming runtime patch, and tightened the privileges of the Budae-jjigae sidecar.

**Outcome:** The patched Web and Sidekiq containers were deployed to production and verified healthy, with zero restarts at the observed checkpoint. HTTPS, actual Web requests, federation intake, and Sidekiq jobs were functioning in the sampled logs. The source changes were merged via CI-validated PR #8. This does not constitute a full security audit or prove that every application feature was exercised.

## Version changes

| Component | Before | After |
| --- | --- | --- |
| Mastodon application | 4.7.3 | 4.7.3 (unchanged) |
| Ruby | 4.0.6 | 4.0.7 |
| Bundler lock metadata | 4.0.18 | 4.0.20 |
| Ruby `resolv` | 0.7.0 | 0.7.2 in the tested Ruby 4.0.7 base |
| `css_parser` | 3.0.0 | 3.3.0 |
| `ssrf_filter` | 1.5.0 | 1.6.0 |
| Streaming Node.js | older runtime | 24.22.1 in the patched streaming image |
| Budae-jjigae image | `perillamint/budae-jjigae:latest` | same image; container privileges hardened |

The `css_parser` update introduced a new locked `base64` dependency requirement; no unrelated application gems were upgraded in that lockfile update.

## GitHub change history

Source repository: [thanksstevenkim/mastodon-v2](https://github.com/thanksstevenkim/mastodon-v2)

- Branch: `security/ruby-4.0.7`
- [PR #8: Update Ruby runtime to 4.0.7](https://github.com/thanksstevenkim/mastodon-v2/pull/8) — merged.
- Source commits:
  - `77585a3d15` — Ruby and Bundler version metadata
  - `00b9f15b7c` — update pinned `ruby/setup-ruby` action
  - `cf63fba18e` — resolve `css_parser` security advisories
- Merge commit on `main`: `667a9a74f7b0e5120f57145ef9760992c188af7a`

Changed tracked files were limited to `.ruby-version`, `Dockerfile`, `Gemfile.lock`, the shared Ruby setup GitHub Action, and three Ruby-related CI workflows. No database migration files were modified by this PR.

### Why CI initially failed

The first PR checks failed *before linting or testing*, with:

~~~text
Unknown version 4.0.7 for ruby on ubuntu-24.04
~~~

The pinned `ruby/setup-ruby` action knew about versions through 4.0.6. Its SHA was updated in the composite action and direct workflow usages to:

~~~text
984c0c890880bbf811283d6f09c4607c62d210a4 (v1.323.0)
~~~

A separate failure appeared once Ruby setup worked: Bundler Audit reported two advisories for locked `css_parser 3.0.0`:

- `GHSA-84w7-hpvm-rxx2` — regex denial of service
- `GHSA-w3mx-4vv9-hjpg` — possible local file read in particular CSS processing conditions

`bundle lock --update css_parser`, executed in a temporary Ruby 4.0.7 container, resolved `css_parser` to 3.3.0 and `ssrf_filter` to 1.6.0.

The initial attempt to commit locally was blocked by Husky because Yarn was unavailable on the host after removal of its Node.js runtime. The limited file changes were checked using `git diff --cached --check`, and Husky was bypassed **for the individual commits only**. GitHub CI subsequently provided independent checks.

### Final PR CI

On the final commit `cf63fba18e`, GitHub Actions reported success for:

- Bundler Audit
- Ruby Testing
- Ruby Linting
- Haml Linting
- CodeQL
- Test container image build
- Historical data migration test
- Check formatting
- Check i18n

The separate `Build container image for PR` workflow was **skipped**, not passed. The dedicated test container image build succeeded. No failed checks remained on this PR when merged.

## Docker images and scoped deployment

The first independently tested Ruby-only production image was:

~~~text
mustardkim/mastodon-mustard:v4.7.3-ruby4.0.7
~~~

After the locked dependency patch and PR merge, the final local production image was built as:

~~~text
mustardkim/mastodon-mustard:v4.7.3-ruby4.0.7-cssparser3.3.0
~~~

The previous Ruby-only and original `v4.7.3` image tags were kept as rollback references; no image pruning was part of this maintenance. A registry push of the final tag was **not evidenced** in the recorded session. The source's merged `main` commit is known, but the final Docker image's embedded `SOURCE_COMMIT` was not independently inspected.

Other running services were deliberately left on their separate images:

~~~text
streaming: mustardkim/mastodon-mustard:v4.7.3-streaming-node24.22.1
budae:     perillamint/budae-jjigae:latest
~~~

The operator backed up `/opt/mastodon/docker-compose.yml`, changed the **Web and Sidekiq image settings only**, and checked the resolved configuration with `docker compose config -q` and JSON service-image inspection.

Web was recreated first:

~~~bash
docker compose up -d --no-deps --no-build --pull never web
~~~

After Web passed the checks, Sidekiq was gracefully stopped and recreated:

~~~bash
docker compose stop -t 60 sidekiq
docker compose up -d --no-deps --no-build --pull never sidekiq
~~~

A maximum 60-second grace period reduces, but does not eliminate, the risk of interrupting an in-flight background job. This was a runtime/dependency patch; no database migration was run or required by the source changes.

## Evidence and validation

### Before production switch

- Docker image build succeeded.
- Ruby 4.0.7, Bundler 4.0.20 and `resolv 0.7.2` were observed in the Ruby-only image.
- With `BUNDLE_FROZEN=true`, `bundle check` passed in the non-root final image without attempting to rewrite the root-owned lockfile.
- Rails 8.1.3.1 and Sidekiq 8.1.6 loaded in the initial patched image.
- Final image independently reported `css_parser 3.3.0` and `ssrf_filter 1.6.0` with all Bundler dependencies satisfied.

An initial unfrozen `bundle check` could not write `/opt/mastodon/Gemfile.lock` as the container's non-root user. Frozen mode confirmed dependency satisfaction; no permission loosening or root runtime was necessary.

### After production switch

At the final observed checkpoint:

| Check | Observed result |
| --- | --- |
| Web | `healthy`; final patched image |
| Sidekiq | `healthy`; final patched image |
| Streaming | `healthy`; separate Node 24.22.1 image unchanged |
| Budae-jjigae | running; existing image unchanged |
| Web restart count | 0 |
| Sidekiq restart count | 0 |
| HTTPS | `HTTP/2 200` from `https://mustard.blog/` |
| Web activity | successful API, post creation and ActivityPub inbox responses (200/202) |
| Background processing | multiple `ActivityPub::DeliveryWorker`, `ProcessingWorker`, `DistributionWorker` and `FeedInsertWorker` jobs finished with `done` |
| Runtime gems in Web and Sidekiq | `css_parser 3.3.0` and `ssrf_filter 1.6.0` |

Sidekiq initially showed `health: starting` shortly after recreation, then reached `healthy` at the subsequent check. Raw remote-user URLs and request-level identifiers are intentionally not reproduced here.

No prolonged outage or application regression was visible in the sampled checks. **Downtime was not measured**, and end-to-end login, every media format, and full federation delivery correctness were not exhaustively tested. Database, Redis, Elasticsearch and Nginx were not separately revalidated during the final scoped rollout; this log does not imply otherwise.

## Adjacent infrastructure hardening

### Streaming runtime

The separately built image `v4.7.3-streaming-node24.22.1` was verified healthy with Node.js 24.22.1. It was not overwritten when updating Web and Sidekiq.

### Budae-jjigae container

The `perillamint/budae-jjigae:latest` image was previously identified as based on an outdated Alpine 3.18 base. It remained in service; this maintenance did **not** fix its base-image lifecycle risk.

The Compose service was hardened and verified with:

~~~yaml
user: "65534:65534"
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
read_only: true
~~~

Runtime verification showed UID 65534, no effective capabilities, `NoNewPrivs=1`, a read-only root filesystem, zero restarts, and HTTP 200 from its loopback healthcheck.

This is risk reduction, **not** a substitute for rebuilding or replacing the outdated base image.

## Recovery, limitations and follow-up

- Keep the previous tagged images and timestamped Compose backups; do not prune them casually.
- For a regression without schema changes, restore the prior Web/Sidekiq image tags in Compose, validate `docker compose config -q`, and recreate only affected services; then re-check HTTP, Sidekiq jobs and restart counts.
- Do not use an unverified `latest` tag as the only rollback target.
- Verify availability of a recent database/media backup according to [backup procedures](../runbooks/backup.md). A separate database/media backup verification **during this patch session** was not recorded; previously documented encrypted off-host evidence backup in [SUP-0013](../incidents/013-intermittent-web-latency-and-webfinger-request-concentration.md) should not be treated as proof of a complete, current application restore set.
- Replace or rebuild Budae-jjigae on a supported base image when available, validating its behavior before retiring the hardened older container.
- Inspect final image provenance/digest and keep ongoing vulnerability scans in the maintenance workflow.

See the [repeatable runtime/dependency security patch runbook](../runbooks/runtime-dependency-security-patches.md).

