# Mastodon 4.7.3: Ruby 4.0.9 Security Maintenance (Manual Base Image)

## Date and status

- **Date:** 2026-10-23 (JST)
- **Application:** Mastodon 4.7.3 (unchanged)
- **Runtime change:** Ruby 4.0.7 → **4.0.9** for production Web and Sidekiq
- **Observed deployment status:** Web and Sidekiq healthy; both on the new Ruby 4.0.9 image; real federation intake and background work confirmed
- **Source PR status at observation:** [mastodon-v2 PR #9](https://github.com/thanksstevenkim/mastodon-v2/pull/9) remained **open and unmerged**; container-build CI failed because the official Ruby 4.0.9 Docker Hub tag was absent
- **Build provenance:** locally built Ruby base image using the upstream official Dockerfile, *not* an image published under the official Docker Hub `library/ruby` repository

This is a scoped runtime security update, not a Mastodon application release or full security audit. It follows the [2026-10-22 runtime and gem security maintenance](4-7-3-security-maintenance-2026-10-22.md).

## Reason for the maintenance

Ruby 4.0.9 was released on 2026-10-23 to address a regular-expression compilation vulnerability in Onigmo, following fixes also incorporated in 4.0.8. The issue is relevant to software that compiles attacker-controlled regular-expression patterns. An exploitable path within this Mastodon installation **was not demonstrated**. Applying the Ruby patch was a preventive security measure.

## Source change and CI status

[mastodon-v2 PR #9](https://github.com/thanksstevenkim/mastodon-v2/pull/9) was opened on branch `security/ruby-4.0.9` at commit `e5ddc3df3a2a2cc01d6f12dc291e35293c57a97a`.

The seven changed files were `.ruby-version`, `Dockerfile`, `Gemfile.lock`, `.github/actions/setup-ruby/action.yml`, and three GitHub Actions workflows. The Ruby-version lockfile entry and Dockerfile base version changed to 4.0.9; locked application gems were intentionally preserved. The pinned `ruby/setup-ruby` action was updated to `v1.334.0`, which supports Ruby 4.0.9.

At the last inspected PR checkpoint:

- Passed: Ruby Testing, Ruby Linting, Haml Linting, Bundler Audit, CodeQL, formatting, i18n, historical data migration.
- Failed: Test container image build on amd64 and arm64 for the Ruby-based image, with `docker.io/library/ruby:4.0.9-slim-trixie: not found`. The independent Streaming image build succeeded in the tested matrix.
- Skipped: the separate `Build container image for PR` workflow.
- The official Docker image tag had not yet appeared. **The successful local build and production rollout below do not change the CI result.**

## Building the Ruby base before Docker Hub publication

The operator verified that the official upstream [docker-library/ruby Dockerfile](https://github.com/docker-library/ruby/blob/master/4.0/slim-trixie/Dockerfile) had been updated to Ruby 4.0.9. The build used a pinned Git commit instead of a mutable `master` download:

- Dockerfile source revision: `docker-library/ruby@566c0b5ecc3c1c5ce82ab5a94962cb02ceaba14b`
- Dockerfile blob: `e7ac0a4f66468500dc2294034ace7c83e96171a3`
- Ruby source tarball SHA-256 was pinned by that upstream Dockerfile.
- Architecture for the observed local image: `linux/amd64`.

The operator built the base locally with the expected tag:

~~~bash
docker buildx build --builder default --platform linux/amd64 --load \
  --progress=plain -t ruby:4.0.9-slim-trixie .
~~~

Using the `security/ruby-4.0.9` worktree, the Mastodon image was then built with its unmodified Ruby 4.0.9 `FROM` reference, resolving to the locally constructed base:

~~~bash
docker buildx build --builder default --platform linux/amd64 --load \
  --pull=false --progress=plain \
  --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" \
  -t mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9 .
~~~

The resulting Mastodon image was pushed successfully to the operator's Docker Hub repository. The operator verified the remotely accessible manifest:

~~~text
docker.io/mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9
sha256:ef921e02ca7336fdbef485f186c79fcdf94fc1665e0026a7e816b8ed162d05fb
~~~

**Important:** This is a manually assembled upstream-source-based dependency chain; it is not proof that Docker Hub published the corresponding official Ruby image or that the self-built base is byte-identical to a later official image. The observed pushed manifest was not a multi-architecture release.

## Local image verification

The image was tested without creating production services:

~~~bash
docker run --rm --pull never --entrypoint /bin/sh \
  mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9 \
  -c 'ruby -v; BUNDLE_FROZEN=true bundle check; gem list --local css_parser; gem list --local ssrf_filter'
~~~

Observed:

- Ruby `4.0.9` with YJIT and PRISM on x86_64.
- `The Gemfile's dependencies are satisfied`.
- `css_parser 3.3.0` and `ssrf_filter 1.6.0` remained installed.
- The `gem list` checks emitted repeated RDoc duplicate-constant warnings because the packaged Ruby default RDoc 7.0.4 and bundle RDoc 8.0.0 were both loaded. The commands completed; this warning is **not** evidence of a fatal runtime error, but it is worth monitoring if runtime startup errors emerge.

## Production rollout and observed validation

Before rollout, the operator was instructed to take a timestamped backup of `/opt/mastodon/docker-compose.yml`, then change the `web` and `sidekiq` image references only. Backup creation and the complete resolved Compose diff were **not independently shown** in the final pasted logs. Database, Redis, Elasticsearch and Streaming were not intentionally recreated.

Web was updated first:

~~~bash
docker compose up -d --no-deps --no-build --pull never web
~~~

Post-switch observations:

- Web ran `v4.7.3-ruby4.0.9` and reported `healthy`.
- `docker compose exec -T web ruby -v` returned Ruby 4.0.9.
- Public `https://mustard.blog/` returned HTTP/2 200.
- Numerous real `POST /inbox` requests reached `ActivityPub::InboxesController` with HTTP 202.
- Sidekiq was still on the previous Ruby 4.0.7 image and `healthy` at this intermediate checkpoint.

The operator then stopped/recreated Sidekiq using the same new image, validating it separately. Final observations:

| Check | Result |
| --- | --- |
| Web image | `mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9` — healthy |
| Sidekiq image | `mustardkim/mastodon-mustard:v4.7.3-ruby4.0.9` — healthy |
| Streaming image | Existing `v4.7.3-streaming-node24.22.1` — healthy and unchanged |
| Sidekiq `ruby -v` | `4.0.9` |
| Sidekiq `ActivityPub::ProcessingWorker` | Repeated `done` records |
| Sidekiq `ActivityPub::DeliveryWorker` | Repeated `done` records |
| Web restarts | 0 |
| Sidekiq restarts | 0 |

The demonstrated `202` and `done` results are strong evidence of operational continuity in these sampled workloads, not exhaustive proof that every inbound/outbound federation operation or end-user feature succeeded. Long-term monitoring was not reported.

## Recovery and follow-up

- Retain the previously verified rollback image: `mustardkim/mastodon-mustard:v4.7.3-ruby4.0.7-cssparser3.3.0`. Preserve timestamped Compose backups; avoid image pruning.
- On a regression, restore the previous Web and/or Sidekiq image references; check `docker compose config -q`, then recreate **only** the affected service with `--no-deps --no-build --pull never`.
- Monitor Web errors, Sidekiq job failure/retry rates, actual Inbox acceptance, and user-facing features after the initial successful checks.
- Resolve [PR #9](https://github.com/thanksstevenkim/mastodon-v2/pull/9)'s container CI failure separately. A local build does not justify marking failing GitHub Actions green. Once the official Ruby tag becomes available, rerun the build CI and merge through the established review process; an independently verifiable alternative CI build route can be considered if the tag remains delayed.
- Keep this manual base-image provenance attached to the deployed artifact and distinguish self-built Ruby from the official published Ruby image in public communications.
