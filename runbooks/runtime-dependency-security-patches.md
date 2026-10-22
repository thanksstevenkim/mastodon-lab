# Runtime and Dependency Security Patch Runbook

## Purpose

Apply a security-only runtime or locked-dependency fix to an already deployed Mastodon release **without conflating it with an upstream Mastodon version upgrade**. Use [the full upgrade runbook](upgrade.md) for application releases or migrations, and see the [2026-10-22 production example](../update-log/4-7-3-security-maintenance-2026-10-22.md).

> **Scope:** A tested local Docker Compose installation with separate `web`, `sidekiq` and `streaming` services. Adjust paths, image tags, dependency names and backup requirements for the actual deployment.

## 1. Investigate and constrain the change

- Record the currently deployed image tags and current `main` source commit.
- Identify the vulnerable package, affected version, fixed release, advisory and whether it is installed in the application image or a separate service.
- Check upstream compatibility, runtime requirements and any applicable security notes.
- Confirm that database migrations or schema changes are not mixed into the patch; stop and use the full upgrade runbook when they are.
- Verify recent database/media backups and keep a tested recovery path.
- Record whether a registry copy of rollback images exists; an image that exists only on the host does not survive host loss.

Do not broaden a security patch into unrelated dependency upgrades or host OS migrations.

## 2. Isolate source changes in Git

~~~bash
cd ~/mastodon-v2
git switch main
git pull --ff-only origin main
git status --short
git switch -c security/example-runtime-patch
~~~

Update the required version pins. For a scoped Ruby gem update, use a compatible Ruby container against the checked-out lockfile, rather than changing a host runtime just for the lock operation:

~~~bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e BUNDLE_USER_HOME=/tmp/.bundle \
  -e BUNDLE_APP_CONFIG=/tmp/.bundle \
  -v "$PWD:/workspace" -w /workspace \
  ruby:4.0.7-trixie \
  bundle lock --update PACKAGE_NAME
~~~

Review `git diff --check`, `git diff --stat` and the full lockfile diff. Record every transitive gem that changes and why. The Ruby version above is an example from 2026-10-22, not a standing recommendation for future releases.

## 3. Keep CI able to install the selected runtime

If GitHub Actions fails with `Unknown version ... for ruby` at the setup step, check whether `ruby/setup-ruby` is pinned to an older commit whose prebuilt version list does not include the new release.

Update the **exact action SHA** in both shared composite actions and direct workflow uses to a verified upstream commit that supports the required runtime. Do not confuse a setup failure with a Rails test failure; and do not unpin trusted actions without considering the repository's pinning policy.

After a PR is pushed, require the relevant lint, test, vulnerability audit and build checks to pass. A skipped workflow is **not** evidence of a pass. If Bundler Audit flags a real advisory, resolve it rather than disabling the audit.

A missing local Yarn can prevent Husky from running after the host Node runtime has been removed. A single-commit hook bypass should only follow a reviewed diff and should be documented; CI is still mandatory.

## 4. Build a separate production image

Build from a clean, recorded, reviewed source commit; use a **new versioned image tag** while preserving the previous tags. For example:

~~~bash
cd ~/mastodon-v2
git status --short --branch
git rev-parse HEAD
docker build --pull --progress=plain \
  --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" \
  -t mustardkim/mastodon-mustard:PATCHED_TAG \
  -f Dockerfile .
~~~

Avoid `--no-cache` unless there is a specific need. Do not prune existing rollback layers as part of deployment. Record the final image ID/digest and whether the image was pushed to a registry.

Run a no-network inspection before switching production:

~~~bash
docker run --rm --network none \
  -e BUNDLE_FROZEN=true \
  --entrypoint /bin/bash \
  mustardkim/mastodon-mustard:PATCHED_TAG \
  -lc 'set -e; ruby -v; bundle -v; bundle check'
~~~

Check the exact patched gems and application framework libraries, too. `BUNDLE_FROZEN=true` is useful when a non-root Mastodon image has a root-owned `Gemfile.lock`; do not work around harmless write errors by making the lockfile world-writable or running services as root.

## 5. Back up and validate Compose configuration

~~~bash
cd /opt/mastodon
sudo cp -a docker-compose.yml \
  "docker-compose.yml.bak.patch.$(date +%Y%m%d-%H%M%S)"
~~~

Change only the intended service image fields. Be mindful of shared YAML anchors. Never assume the streaming image uses the same runtime as Web/Sidekiq.

~~~bash
docker compose config -q
docker compose config --format json | python3 -c '
import json, sys
services = json.load(sys.stdin)["services"]
for name in ("web", "sidekiq", "streaming", "budae"):
    if name in services:
        print("{}: {}".format(name, services[name].get("image", "unset")))
'
~~~

Stop before deployment if any unrelated service resolves to a different image tag.

## 6. Roll out one service at a time

First recreate **Web only**:

~~~bash
docker compose up -d --no-deps --no-build --pull never web
docker compose ps web
docker compose logs --tail=40 web
curl -I --max-time 10 https://YOUR_INSTANCE_HOST/
~~~

Check the live Ruby/gem versions, `healthy` state, actual HTTP results, and logs. If Web fails, stop the rollout and restore the previous Web image tag before changing Sidekiq.

After Web passes, allow Sidekiq a graceful shutdown and recreate it:

~~~bash
docker compose stop -t 60 sidekiq
docker compose up -d --no-deps --no-build --pull never sidekiq
~~~

The timeout is a grace period, not a guarantee all in-flight jobs complete.

## 7. Confirm health beyond the container state

~~~bash
docker compose ps web sidekiq streaming budae
docker inspect mastodon-web-1 mastodon-sidekiq-1 \
  --format '{{.Name}} RestartCount={{.RestartCount}}'
docker compose logs --tail=60 sidekiq
~~~

Confirm Web and Sidekiq are healthy after startup, restart counts are not increasing, and worker jobs show completions. Check HTTPS and a representative application endpoint, plus relevant federation, streaming and media behavior where practical.

Record separately which checks were **observed**, which were **not performed**, and which require monitoring. The presence of `done` for a Sidekiq job proves local job completion, not necessarily remote delivery/application correctness.

## 8. Rollback and documentation

For runtime-only changes with no incompatible schema migration:

1. Keep the original image tags and Compose backup.
2. Restore the previous image tag for the affected service(s).
3. Validate `docker compose config -q` before recreating services.
4. Recreate affected Web/Sidekiq services with `--no-deps --no-build --pull never`, then repeat checks.
5. Record the incident and results; for migration-bearing releases, consult [upgrade rollback guidance](upgrade.md#rollback) instead.

Create a dated entry in `update-log/` with source commit and PR, exact image tags, backup references, CI status including skips, rollout sequence, bounded validation results, downtime if measured, and outstanding risks.

Do not publish production-only secrets, raw user data, active IOC/blocklist values or live security-control thresholds.

