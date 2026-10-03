# Ticket ID

SUP-0012

# Title

Sidekiq pull-queue backlog after deletion of a long-dormant federated account

# Severity

Low / Operational degradation

- No production outage occurred
- Web, streaming, database, Redis, and other primary services remained available
- The backlog was concentrated in the low-priority `pull` queue
- High-priority and ordinary queues remained near empty during the investigation
- The queue drained without destructive intervention

# Environment

- Mastodon 4.7.3
- Docker Compose
- PostgreSQL 14
- Redis
- Sidekiq 8.1.6
- Nginx
- Elasticsearch
- Custom Mastodon fork

# Issue

The Sidekiq dashboard showed repeated periods of apparent congestion.

Initial inspection found that the congestion was isolated to the `pull` queue
rather than affecting all Sidekiq work.

The backlog appeared shortly after deletion of a long-dormant local account
whose last known activity dated to 2023-01-20.

# Symptoms

Queue inspection showed:

```text
default: size=0
ingress: size=0
mailers: size=0
pull: size=3665
push: size=0
scheduler: size=0
```

The oldest queued `pull` job had been waiting for approximately 15-20 minutes.

Additional Sidekiq state at the time included:

```text
retry: 883
dead: 435
busy: 5/5
```

The Sidekiq process was therefore fully occupied while processing low-priority
jobs.

# Impact

The primary effect was delayed processing of low-priority federation work.

No evidence was found that the instance-wide Sidekiq process had crashed or that
all job classes were blocked.

The `push` queue was empty during the initial inspection, which indicated that
the main congestion was not in the ordinary high-priority delivery path.

# Investigation

## Queue-class distribution

The `pull` queue was grouped by worker class.

A snapshot showed:

```text
ActivityPub::LowPriorityDeliveryWorker: 2213
LinkCrawlWorker: 162
ActivityPub::SynchronizeFeaturedCollectionWorker: 15
ThreadResolveWorker: 5
ActivityPub::SynchronizeFeaturedCollectionsCollectionWorker: 4
ActivityPub::SynchronizeFeaturedTagsCollectionWorker: 3
AccountRefreshWorker: 3
AddToPublicStatusesIndexWorker: 1
FetchReplyWorker: 1
```

Approximately 92% of the queued jobs in that snapshot were
`ActivityPub::LowPriorityDeliveryWorker`.

## Federation delivery failures

Sidekiq logs showed a broad set of failures while delivering ActivityPub
messages to remote inboxes.

Observed failure classes included:

- DNS resolution failures
- connection timeouts
- read timeouts
- expired certificates
- self-signed certificates
- TLS negotiation errors
- HTTP 301/302 responses that could not be followed
- HTTP 500, 502, 503, and 530 responses
- connection reset errors

The failures were distributed across many remote domains rather than one single
destination.

This indicated that the local worker pool was spending substantial time on
unavailable or misconfigured remote servers.

## Activity-level correlation

Queued `ActivityPub::LowPriorityDeliveryWorker` jobs were grouped by ActivityPub
activity ID without printing activity payloads or signatures.

The remaining low-priority delivery backlog resolved to a single activity:

```text
388  Delete  <local-account-delete-activity>
```

The corresponding account-deletion activity had been created at approximately
13:44 UTC on 2026-10-03.

The oldest `pull` queue latency observed shortly afterward aligned closely
with that creation time.

This strongly correlated the queue spike with the account-deletion federation
fan-out.

## Queue drain behavior

The backlog was observed to decrease rapidly without intervention:

```text
pull queue: 3665
low-priority delivery jobs: 2213
pull queue shortly afterward: 1823
remaining correlated low-priority delivery jobs: 388
```

The decline showed that Sidekiq was processing the workload rather than being
deadlocked.

# Root Cause

The immediate cause of the backlog was a large federation fan-out triggered by
deletion of a long-dormant local account.

Mastodon attempted to deliver the account `Delete` activity to many remote
inboxes associated with the account's historical federation relationships.

A significant number of those remote endpoints were no longer healthy or
reachable.

Because the account had been inactive since early 2023, a plausible
contributing factor was that some of the remote servers present in its older
federation graph had disappeared, expired, or become misconfigured during the
intervening years.

The investigation supports the stale-remote-endpoint explanation through the
observed DNS, TLS, timeout, redirect, and 5xx failures. It does not establish
the exact age or status history of every remote server.

The local Sidekiq process had concurrency 5, so repeated network failures and
timeouts temporarily consumed the available worker threads and increased queue
latency.

# Resolution

No queue deletion, retry purge, or Sidekiq restart was performed.

The backlog was allowed to drain normally.

This avoided discarding account-deletion federation messages that still had a
chance of being delivered successfully.

# Verification

Verification showed:

- the `pull` queue size decreased continuously
- `ActivityPub::LowPriorityDeliveryWorker` jobs dominated the backlog
- the remaining low-priority delivery jobs all mapped to one account-delete
  activity
- other primary queues remained near empty
- Sidekiq workers stayed active at full concurrency while draining the queue
- the backlog fell substantially within minutes

The evidence was consistent with a temporary workload spike rather than a
Sidekiq process failure.

# Lessons Learned

- Deleting one federated account can generate a large number of outbound
  federation deliveries.
- Old federation relationships can preserve references to remote servers that
  later disappear or become unhealthy.
- A large `pull` queue does not by itself mean that Sidekiq has crashed.
- Queue size, queue latency, worker concurrency, worker class distribution, and
  retry counts should be inspected together.
- `ActivityPub::LowPriorityDeliveryWorker` can dominate the `pull` queue
  during account-deletion federation fan-out.
- Queue latency may continue increasing temporarily while an old batch is still
  being processed, even if the total queue size is falling.
- Remote DNS, TLS, redirect, timeout, and 5xx failures should be distinguished
  from local application failures.
- Restarting Sidekiq or deleting retry jobs too early can destroy useful
  evidence and may discard valid federation work.
- Large-scale cleanup of dormant accounts should be rate-limited or batched
  rather than performed all at once.

# Prevention

- Monitor `pull` queue size and latency during account cleanup operations.
- Inspect worker-class distribution before restarting Sidekiq.
- Avoid bulk deletion of many old federated accounts in a single batch.
- Prefer gradual account cleanup so federation fan-out remains within normal
  Sidekiq capacity.
- Track repeated failures to permanently dead remote domains separately from
  local Sidekiq health.
- Consider a dedicated low-priority Sidekiq process only if similar backlogs
  become frequent or begin affecting normal production traffic.
