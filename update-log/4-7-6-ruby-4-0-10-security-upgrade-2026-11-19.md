# Mastodon 4.7.6 and Ruby 4.0.10 Security Upgrade (2026-11-19)

## Scope and outcome

- **Service:** Mustard, production Mastodon on Docker Compose with custom Nori-backed Korean search.
- **Previous deployment:** Mastodon 4.7.5, Ruby 4.0.9.
- **New deployment:** **Mastodon 4.7.6, Ruby 4.0.10**.
- **Status:** **Deployed and verified on November 19, 2026 (JST)** from operator-provided execution output.
- **Purpose:** Address the Ruby runtime security release and Mastodon 4.7.6 dependency/security updates in a single image build and application deployment.

Mastodon 4.7.6 updated the Ruby version, Dockerfile Ruby base image and gem dependencies, including Puma, Rails, Sanitize, Msgpack and Omniauth. Upstream's 4.7.5-to-4.7.6 comparison did not show a new database migration file.

## Source integration and image build

The existing 4.7.5 upgrade commit `1842ee0195` was preserved. The operator fetched the official `v4.7.6` tag and created the local `upgrade-4.7.6` branch. One `Gemfile.lock` conflict was resolved by selecting `ruby 4.0.10`; all other changes auto-merged.

- **Local merge commit:** `5bdc0290c0` — `Merge tag 'v4.7.6' into upgrade-4.7.6`
- **Git working tree after merge:** clean
- **Ruby specification:** `.ruby-version`, `Dockerfile` and `Gemfile.lock` agreed on 4.0.10
- **Custom search:** six tracked Nori files remained; no Nori/search-related paths appeared in the diff between the prior and new merge commits

The commit initially failed because the local Husky hook could not find `yarn`. After lockfile resolution and `git diff --cached --check`, the operator completed this merge commit with the Git hook disabled **for that single invocation**. This was not a report of successful local frontend linting or automated test-suite execution. A remote push of the source branch is **not confirmed** by this record.

The operator built and loaded:

```text
mustardkim/mastodon-mustard:v4.7.6-ruby4.0.10-5bdc0290c0
sha256:d2bbd0e0d2d463ab26eb0b83ebe0677d4328882527a4320279fe585afbece505
```

The Docker build completed successfully, including Bootsnap precompilation, FFmpeg and libvips checks. A no-network image check returned `ruby 4.0.10`, `MASTODON=4.7.6`, and `NORI_FILES=OK`.

The Dockerfile's final recursive `chown` step took 2445.7 seconds; this was consistent with a previously observed slow build stage. No build optimization or unnecessary second build was performed.

## Controlled production deployment

The effective Compose configuration initially pointed both `web` and `sidekiq` at the 4.7.5 image. The operator backed up the override before replacing those two references:

```text
/opt/mastodon/docker-compose.override.yml.bak-pre-4.7.6-20261119T133416Z
```

The operator changed only the two service image references in `docker-compose.override.yml`; `docker compose config --quiet` succeeded, and the effective image configuration reported the new tag for both services.

A scoped deployment followed:

```bash
docker compose up -d --no-deps --no-build --pull never web sidekiq
```

Both containers were recreated and started with the new image. At the immediate post-start observation their health states were `starting`; the subsequent dedicated health check confirmed both `healthy`. No database migration, search reindex, host Nginx change or separate Ruby package update was performed as part of this deployment. Other infrastructure services were outside the requested deployment scope.

## Post-deployment evidence

| Check | Observed result |
| --- | --- |
| Web container | `healthy` |
| Sidekiq container | `healthy` |
| Web and Sidekiq image | `v4.7.6-ruby4.0.10-5bdc0290c0` |
| Local `http://127.0.0.1:3000/health` | OK |
| Public `https://mustard.blog/` | HTTP 200 |
| Rails `Mastodon::Version.to_s` | `4.7.6` |
| Rails `RUBY_VERSION` | `4.0.10` |
| `NoriSearch::ReadIndexes.enabled?` | `true` |
| Admin Elasticsearch `mismatched_indexes` | `[]` |

**Conclusion:** The version/Ruby security update and operational deployment checks were completed. The health checks demonstrate the observed point-in-time state, not a full feature, federation, security or recovery audit. In particular, Nori file presence, read-routing enablement and index configuration consistency do not establish a complete end-to-end search regression test.

## Preservation and follow-up

- Retain the previous 4.7.5 image and the dated Compose override backup for rollback; this workflow did not deliberately remove them. Availability of rollback resources was not independently rechecked after deployment.
- No repeat Nori indexing, broad automated test campaign, reboot or unrelated R2 maintenance is needed to close this upgrade.
- The previous Nginx USN-9159-1 patch and the November 23 R2 cleanup-monitoring checkpoint remain separate workstreams.
- This log records completion of the **technical deployment**. A new user-facing notice was drafted separately; publication is not asserted here.
