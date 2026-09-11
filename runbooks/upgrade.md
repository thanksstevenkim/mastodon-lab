# Mastodon Upgrade Runbook

## Purpose

Use this runbook to merge an upstream Mastodon release into the maintained fork, validate the resulting source tree, publish versioned custom Docker images, deploy them to production, and verify the result.

This procedure reflects this repository's production environment and deployment workflow.

Always read the upstream release notes for every intermediate version between the currently deployed release and the target release. Some Mastodon releases introduce additional runtime requirements, long-running database migrations, or pre/post-deployment migration procedures that require adapting this runbook.

---

## Variables

Set the current and target versions before starting.

Keep the leading `v` in both values.

```bash
export PREVIOUS_VERSION=vA.B.C
export TARGET_VERSION=vX.Y.Z
export IMAGE=mustardkim/mastodon-mustard
```

---

## Preconditions

Before beginning the upgrade:

- Schedule a maintenance window if downtime is expected.

- Notify users in advance when appropriate.

- Read the upstream release notes for every release between `$PREVIOUS_VERSION` and `$TARGET_VERSION`.

- Confirm that the target release supports the deployed versions of:
  - Ruby
  - Node.js
  - PostgreSQL
  - Redis
  - Elasticsearch, if enabled

- Confirm that the working tree is clean.

- Confirm that the `upstream` remote points to:

  ```text
  https://github.com/mastodon/mastodon.git
  ```

- Verify that a recent PostgreSQL backup exists.

- Verify that uploaded media is backed up.

- Confirm that the restore procedure is available before starting.

- Record the currently deployed application and streaming image tags.

- Retain the previous Docker images for rollback.

- Confirm access to:
  - the container registry
  - the production host
  - the application source repository

- Ensure that the maintenance window is long enough for potentially expensive database migrations.

Some Mastodon migrations can run for many minutes on a production database.

Do not assume that a migration is stuck only because it produces no output for an extended period. Inspect the migration process and database activity before interrupting it.

---

## 1. Prepare the Source

Work on a dedicated upgrade branch rather than merging an upstream release directly into `main`.

```bash
cd ~/mastodon
git status --short
git remote -v
git fetch --tags upstream
git tag --verify "$TARGET_VERSION"
```

Create an upgrade branch:

```bash
git checkout -b "upgrade-${TARGET_VERSION#v}"
```

Merge the upstream release:

```bash
git merge --no-ff "$TARGET_VERSION"
```

Resolve merge conflicts deliberately.

Do not automatically prefer the fork or upstream version of every conflicting file.

For each conflict, determine whether the difference represents:

- an intentional local customization
- obsolete fork drift
- a dependency or build-system change
- an upstream application change that should replace the local version

Dependency locks, runtime versions, framework configuration, build-system files, and generated metadata should normally follow the target upstream release unless there is a documented local reason not to.

After resolving all conflicts:

```bash
git diff --check
git status
```

Confirm that:

- no conflict markers remain
- no `Unmerged paths` remain
- `git diff --check` produces no output

If needed, search explicitly for unresolved conflict markers:

```bash
git grep -nE '^(<<<<<<< |>>>>>>> )'
```

---

## 2. Validate the Source

Install the dependencies required by the target release.

Follow the target release's runtime requirements rather than assuming that the current Ruby, Node.js, Bundler, or Yarn versions remain valid.

Typical commands include:

```bash
bundle install
yarn install --immutable
```

Run the checks appropriate for the release.

Examples:

```bash
yarn lint:js --max-warnings 0
git diff --check
```

Run the Ruby test suite when practical:

```bash
RAILS_ENV=test \
DB_HOST=localhost \
DB_USER=mastodon_test \
DB_PASS='test-password' \
bundle exec rspec
```

The local test environment may require additional services and utilities such as:

- PostgreSQL
- Redis
- ffmpeg
- ffprobe

Do not interpret infrastructure failures as application regressions before confirming that the test environment is complete.

When a full test suite produces a large number of failures, identify the earliest underlying exception before investigating later cascading failures.

Verify any intentional local tooling customizations before committing the merge.

Examples include:

```bash
grep -n 'lint-staged' .husky/pre-commit
grep -nE 'rubocop|haml|tsc' lint-staged.config.js
```

After validation is complete:

```bash
git status
git commit
git push origin "upgrade-${TARGET_VERSION#v}"
```

Wait for the repository's CI checks to complete.

Do not proceed to the production build until the upgrade branch has passed the required checks.

---

## 3. Merge the Validated Upgrade into `main`

After the upgrade branch has passed local validation and CI:

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff "upgrade-${TARGET_VERSION#v}"
git push origin main
```

Build production images from the resulting `main` commit.

Record the exact source commit before or after the build:

```bash
git rev-parse --short HEAD
```

The source tree must remain unchanged between the recorded commit and the image build.

Record this commit hash in the corresponding upgrade log.

---

## 4. Build and Publish Images

Build immutable, versioned application and streaming images from the validated `main` branch.

Application image:

```bash
docker build -t "$IMAGE:$TARGET_VERSION" .
```

Streaming image:

```bash
docker build \
  -f streaming/Dockerfile \
  -t "$IMAGE:$TARGET_VERSION-streaming" .
```

Verify that the images were created:

```bash
docker images | grep mastodon-mustard
```

Publish the versioned tags first:

```bash
docker push "$IMAGE:$TARGET_VERSION"
docker push "$IMAGE:$TARGET_VERSION-streaming"
```

Only move `latest` after the versioned application image has built successfully and completed the required validation:

```bash
docker tag "$IMAGE:$TARGET_VERSION" "$IMAGE:latest"
docker push "$IMAGE:latest"
```

Do not use `latest` as the only rollback reference.

Keep the immutable versioned image tags available until the new release has been stable in production.

---

## 5. Prepare Production Deployment

On the production host:

```bash
cd /opt/mastodon
```

Update the application and streaming image tags in `docker-compose.yml` from `$PREVIOUS_VERSION` to `$TARGET_VERSION`.

Before changing running services, validate the Compose configuration:

```bash
docker compose config --quiet
```

Pull the new images:

```bash
docker compose pull
```

Confirm that Compose resolves the expected image tags:

```bash
docker compose images
```

Do not proceed if the rendered configuration or image tags are unexpected.

---

## 6. Run Pre-deployment Migrations

For Mastodon releases that include post-deployment migrations, run only the pre-deployment migrations before switching the running application to the new version.

Use:

```bash
docker compose run --rm \
  -e SKIP_POST_DEPLOYMENT_MIGRATIONS=true \
  web bundle exec rails db:migrate
```

This command must complete successfully before replacing the running application containers.

Some migrations may take significantly longer than previous upgrades.

Do not interrupt a migration solely because it appears idle.

If the command fails:

- stop the deployment
- capture the error output
- inspect the database state
- do not repeatedly rerun migrations without understanding the failure

---

## 7. Start the New Application Version

Start or recreate the services using the new images:

```bash
docker compose up -d
```

Inspect the service state:

```bash
docker compose ps
```

Confirm that the running containers use the expected image tags:

```bash
docker compose images
```

Avoid combining:

```bash
docker compose down && docker compose up -d
```

into a single command.

If startup fails, combining both operations makes it harder to determine which step failed and can unnecessarily extend downtime.

If schema-changing migrations were applied while existing Rails processes were already running, explicitly restart the Rails application processes:

```bash
docker compose restart web sidekiq
```

This ensures that ActiveRecord reloads the current database schema.

---

## 8. Run Post-deployment Migrations

After the new application version is running:

```bash
docker compose run --rm web bundle exec rails db:migrate
```

This runs any remaining post-deployment migrations.

After completion, confirm migration status:

```bash
docker compose run --rm web bundle exec rails db:migrate:status
```

Verify that all migrations required by the target release are marked:

```text
up
```

Do not reverse or rerun completed migrations unless there is a confirmed database problem and the release documentation explicitly supports doing so.

---

## 9. Inspect Logs

Inspect recent application logs immediately after deployment:

```bash
docker compose logs --since=10m web sidekiq streaming
```

Also inspect other relevant services when needed:

```bash
docker compose logs --since=10m db redis
```

Look for:

- HTTP 500 responses
- `NameError`
- `NoMethodError`
- `ActiveRecord` errors
- missing database columns
- asset or Vite manifest errors
- Sidekiq job failures
- streaming connection errors
- repeated federation failures

Do not rely only on Docker health checks.

A container may report `healthy` while application requests still fail with runtime exceptions.

---

## 10. Post-upgrade Verification

Verify each item before closing the maintenance window.

### Containers

- All expected Compose services are running.
- Application containers report healthy where health checks are configured.
- The running application and streaming containers use the intended target image tags.

Check:

```bash
docker compose ps
docker compose images
```

### Web application

- The public hostname loads successfully.
- The web UI does not return HTTP 500.
- Public timelines load.
- A test account can sign in.
- A test account can publish a post.

### Streaming

- Streaming updates appear without a full page refresh.
- Streaming logs do not contain recurring connection failures.

### Sidekiq

- Sidekiq is processing jobs.
- Queues are not accumulating unexpectedly.
- No recurring job failure appears after the upgrade.

### Media

- Image upload works.
- Video or audio upload works when applicable.
- Image rendering and thumbnails work.

### Federation

- Incoming federation works with a known peer.
- Outgoing federation works with a known peer.
- New posts can be delivered remotely.
- Remote posts can be received locally.

### Database

- All target-version migrations are `up`.

Check:

```bash
docker compose run --rm web bundle exec rails db:migrate:status
```

### Logs

Inspect:

```bash
docker compose logs --since=10m web sidekiq streaming
```

Confirm that there are no new recurring application errors.

### Backup

- Confirm that the next scheduled backup completes successfully.

---

## 11. Record the Upgrade

Create a new file under:

```text
update-log/
```

Record at minimum:

- upgrade date
- previous version
- target version
- source commit used for the image build
- image tags
- backup reference
- downtime
- runtime or dependency changes
- merge conflicts
- local customizations preserved
- tests and lint results
- migration results
- long-running migrations
- post-upgrade verification results
- incidents or deviations from the normal procedure
- follow-up actions

If an upgrade exposes a repeatable operational issue, update this runbook so that the next upgrade benefits from the experience.

---

## Rollback

If verification fails:

1. Stop the rollout and capture relevant logs before changing the environment.

2. Determine whether the target release's database migrations are backward-compatible.

3. Consult the target release notes before running an older application version against the migrated database.

4. If the database remains compatible, restore the previous application and streaming image tags in `docker-compose.yml`.

5. Validate the Compose configuration:

   ```bash
   docker compose config --quiet
   ```

6. Restart the previous version:

   ```bash
   docker compose up -d
   ```

7. If the database is not backward-compatible, follow the tested PostgreSQL and media restore procedure instead of starting the previous application against the new schema.

8. Repeat the verification checklist.

9. Document the rollback in:
   - the upgrade log
   - an incident report when appropriate

Never reverse migrations or restore a database without accounting for data written after the backup was created.

---

## Troubleshooting

### `git fetch upstream` fails

Inspect the configured remotes:

```bash
git remote -v
```

If `upstream` is missing:

```bash
git remote add upstream https://github.com/mastodon/mastodon.git
git fetch --tags upstream
```

If `upstream` already exists but points to an incorrect URL, fix the existing remote instead of creating a duplicate.

---

### Ruby version required by the target release is unavailable in rbenv

Update `ruby-build`:

```bash
cd ~/.rbenv/plugins/ruby-build
git pull
```

Check whether the required version is now available:

```bash
rbenv install -l
```

Install the required version according to the target release documentation.

Example:

```bash
RUBY_CONFIGURE_OPTS=--with-jemalloc rbenv install X.Y.Z
rbenv rehash
```

Do not modify `.ruby-version` locally just to make an unsupported Ruby version work.

---

### RSpec fails with PostgreSQL authentication errors

Confirm the test database configuration.

Test connectivity directly:

```bash
PGPASSWORD='test-password' \
psql -h localhost \
  -U mastodon_test \
  -d mastodon_test \
  -c 'SELECT 1;'
```

Verify the test migration state:

```bash
RAILS_ENV=test \
DB_HOST=localhost \
DB_USER=mastodon_test \
DB_PASS='test-password' \
bundle exec rails db:migrate:status
```

Do not drop and recreate the test database until the actual failure has been identified.

---

### RSpec fails because Redis is unavailable

Typical error:

```text
Redis::CannotConnectError
Failed to connect to localhost:6379
```

Check Redis:

```bash
redis-cli ping
```

Expected result:

```text
PONG
```

If Redis is unavailable, restore the test Redis service before interpreting later test failures.

---

### Media-related RSpec failures mention `ffmpeg` or `ffprobe`

Typical errors:

```text
Could not run the `ffmpeg` command.
Could not run the `ffprobe` command.
```

Confirm availability:

```bash
ffmpeg -version
ffprobe -version
```

Install ffmpeg if it is missing.

After installing it, rerun the affected media tests before assuming that the merge introduced an application regression.

---

### Web UI returns HTTP 500 after successful migrations

A successful database migration does not guarantee that already-running Rails processes have reloaded the current database schema.

Inspect the web logs:

```bash
docker compose logs --since=5m web
```

A stale schema may produce errors such as:

```text
NameError:
undefined local variable or method `requested_deletion_at'
```

Confirm that the migration itself is applied:

```bash
docker compose run --rm web bundle exec rails db:migrate:status
```

If the relevant migration is already `up`, restart the Rails processes:

```bash
docker compose restart web sidekiq
```

Then reload the web UI and inspect the logs again:

```bash
docker compose logs --since=5m web sidekiq
```

Do not rerun or roll back migrations unless the migration status indicates an actual database problem.

---

### Containers are healthy but the web application is failing

Docker health checks only confirm that the configured health probe succeeds.

They do not guarantee that every application request is working.

Inspect application logs:

```bash
docker compose logs --since=5m web
```

Also verify:

```bash
docker compose images
docker compose ps
```

Confirm that the running web and Sidekiq containers are using the expected target image.

---

### A migration appears to be stuck

Some migrations may perform expensive operations such as:

- rebuilding materialized views
- copying large tables
- creating indexes
- backfilling data

Do not immediately terminate the process.

Inspect:

- migration output
- PostgreSQL activity
- CPU and disk activity
- locks

Only interrupt the migration after confirming that it is actually blocked or failed.

---

## Related Incident Reports

- [Yarn checksum mismatch during upgrade](../incidents/004-yarn-checksum-mismatch-during-upgrade.md)
- [Ruby runtime version mismatch](../incidents/005-ruby-runtime-version-mismatch.md)
- [Merge conflicts after an upstream merge](../incidents/006-merge-conflicts-after-upstream-merge.md)
- [Database migration incomplete after upgrade](../incidents/007-database-migration-incomplete-after-upgrade.md)
- [GitHub Actions failures caused by fork drift](../incidents/009-github-actions-failures-from-fork-drift.md)
