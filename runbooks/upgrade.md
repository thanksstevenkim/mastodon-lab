# Mastodon Upgrade Runbook

## Purpose

Use this runbook to merge an upstream Mastodon release into the maintained fork, publish versioned Docker images, deploy them to production, and verify the result.

This procedure reflects this repository's environment. Read the release notes for every intermediate version and adapt the commands when upstream requires additional steps.

## Variables

Set the target and current versions before starting. Keep the leading `v` in both values.

```bash
export PREVIOUS_VERSION=vA.B.C
export TARGET_VERSION=vX.Y.Z
export IMAGE=mustardkim/mastodon-mustard
```

## Preconditions

- Schedule a maintenance window and notify users if downtime is expected.
- Confirm that the target release supports the deployed Ruby, Node.js, PostgreSQL, and Redis versions.
- Read the upstream release notes for every version between `$PREVIOUS_VERSION` and `$TARGET_VERSION`.
- Confirm that the working tree is clean and the `upstream` remote points to `https://github.com/mastodon/mastodon.git`.
- Verify a recent PostgreSQL backup and uploaded-media backup, and confirm that their restore procedure is available.
- Record the currently deployed image tags and retain the previous images for rollback.
- Confirm access to the container registry and production host.

## 1. Prepare the Source

```bash
cd ~/mastodon
git status --short
git remote -v
git fetch --tags upstream
git tag --verify "$TARGET_VERSION"
git merge --no-ff "$TARGET_VERSION"
```

Resolve merge conflicts deliberately and review the final diff before continuing. Do not build or deploy with unresolved conflicts.

Run the checks required by the target release, then push the reviewed merge to the fork:

```bash
git status
git push
```

## 2. Build and Publish Images

Build immutable, versioned application and streaming images:

```bash
docker build -t "$IMAGE:$TARGET_VERSION" .
docker build -f streaming/Dockerfile -t "$IMAGE:$TARGET_VERSION-streaming" .
```

Smoke-test the images or complete the project's automated checks before publishing them. Publish the versioned tags first:

```bash
docker push "$IMAGE:$TARGET_VERSION"
docker push "$IMAGE:$TARGET_VERSION-streaming"
```

Only move `latest` after the versioned application image has built and passed its checks:

```bash
docker tag "$IMAGE:$TARGET_VERSION" "$IMAGE:latest"
docker push "$IMAGE:latest"
```

## 3. Deploy to Production

On the production host:

1. Change to `/opt/mastodon`.
2. Update the application and streaming image tags in `docker-compose.yml` from `$PREVIOUS_VERSION` to `$TARGET_VERSION`.
3. Validate the rendered Compose configuration before changing the running services.
4. Pull the new images.

```bash
cd /opt/mastodon
docker compose config --quiet
docker compose pull
```

Run database migrations explicitly. This step must succeed before the upgrade is considered complete:

```bash
docker compose run --rm web bundle exec rails db:migrate
```

Start the services with the new images and inspect their state:

```bash
docker compose up -d
docker compose ps
docker compose logs --since=10m web sidekiq streaming
```

Avoid combining `docker compose down` and `docker compose up` in one command: if startup fails, the combined command obscures which operation failed and can extend downtime.

## 4. Post-upgrade Verification

Verify each item before closing the maintenance window:

- All Compose services are running and healthy.
- The web UI and public timelines load through the public hostname.
- A test account can sign in and publish a post.
- Streaming updates appear without a page refresh.
- Sidekiq queues are processing and are not accumulating failures.
- Media upload and image rendering work.
- Incoming and outgoing federation work with a known peer.
- Application, Sidekiq, streaming, Nginx, and database logs contain no new recurring errors.
- The database schema version matches the target release.

  Confirm migration status with:

  ```bash
  docker compose run --rm web bundle exec rails db:migrate:status
  ```
- The next scheduled backup completes successfully.

Record the date, previous version, target version, downtime, backup reference, migration result, verification result, and any deviations in a new file under [`update-log/`](../update-log/).

## Rollback

If verification fails:

1. Stop the rollout and capture relevant logs before changing the environment.
2. Determine whether the release's database migrations are backward-compatible by consulting its release notes.
3. Restore the previous image tags in `docker-compose.yml` and run `docker compose up -d` only when the database remains compatible.
4. If the migration is not backward-compatible, follow the tested database and media restore procedure instead of starting the old application against the new schema.
5. Repeat the verification checklist and document the rollback in the update log and, when appropriate, an incident report.

Never reverse a migration or restore a database without accounting for data written after the backup was created.

## Troubleshooting

### `git fetch upstream` fails

Inspect the configured remotes:

```bash
git remote -v
```

If `upstream` is missing, add it and fetch the tags again:

```bash
git remote add upstream https://github.com/mastodon/mastodon.git
git fetch --tags upstream
```

For authentication, connectivity, or an incorrectly configured existing URL, fix the specific cause instead of adding a duplicate remote.

### Related Incident Reports

- [Yarn checksum mismatch during upgrade](../incidents/004-yarn-checksum-mismatch-during-upgrade.md)
- [Ruby runtime version mismatch](../incidents/005-ruby-runtime-version-mismatch.md)
- [Merge conflicts after an upstream merge](../incidents/006-merge-conflicts-after-upstream-merge.md)
- [Database migration incomplete after upgrade](../incidents/007-database-migration-incomplete-after-upgrade.md)
