# Ticket ID

SUP-0013

# Title

Intermittent web latency with Puma CPU saturation and concentrated WebFinger requests

# Severity

Medium / Temporary production degradation (recovered; root cause unconfirmed)

- Web pages, timelines, notifications, and profiles were reported as generally slow to open.
- Local Puma requests intermittently took more than 15–25 seconds or timed out; some Nginx requests returned HTTP 499/504.
- The instance remained reachable at other times and recovered during investigation.
- No account compromise, malicious intent, or definitive causal relationship was established.

# Environment

- Incident date: 2026-10-19 (Nginx log times in UTC)
- Mastodon 4.7.3, custom Mastodon fork
- Docker Compose, Puma 8.0.2 (2 workers, 5 request threads per worker)
- Sidekiq 8.1.6; PostgreSQL 14; Redis 7; Elasticsearch 8.19.15
- Nginx with Cloudflare real-IP restoration
- Host observed with 8 logical CPUs and approximately 31 GiB RAM

# Issue

The operator reported severe slowness across the Mastodon web interface and initially suspected bulk deletion of an established account.

Investigation identified intermittent Puma request stalls, high CPU utilization in both Puma workers during an affected interval, and heavily delayed WebFinger requests. A large portion of sampled WebFinger traffic came from one apparent client address repeatedly requesting the same URL with varying User-Agent values.

These observations correlate in time but do **not** establish that the WebFinger requester caused Puma saturation, that the requester was malicious, or that an account deletion triggered this incident. The earlier account-deletion Sidekiq backlog is documented separately in [SUP-0012](012-sidekiq-pull-queue-backlog-after-account-deletion.md).

# Symptoms

- Server-wide load averages were approximately 2.12/1.95/1.46 on an 8-logical-CPU host; available RAM was about 25 GiB and root filesystem utilization approximately 7%. Swap was near full at first, but `vmstat` showed no contemporaneous swap-in/swap-out activity.
- Sidekiq reported `enqueued=0`, `busy=0`, and zero waiting jobs/latency in `default`, `ingress`, `mailers`, `pull`, `push`, and `scheduler` at the inspected moment. Retry/dead counts were historical or delayed work, not evidence of an active queue backlog.
- Early successful public requests to `/` and `/api/v2/instance` completed in roughly 0.09–0.19 seconds.
- Later direct requests to Puma via `127.0.0.1:3000/api/v2/instance` took 7–15+ seconds. In another reproduction, the API timed out after 25 seconds and a concurrent `/health` request timed out after 5 seconds.
- A separate API request returned HTTP 200 only after 18.53 seconds.
- In an affected sample, both Puma worker processes reached approximately 100% CPU each, while the host still had substantial overall CPU idle capacity.
- Nginx access logs contained long `request_time` values and HTTP 499/504 results, especially for WebFinger.

# Impact

The service was intermittently difficult to use even though the containers could report healthy and most infrastructure resources remained available.

The operator experienced delayed page loading across the interface. Nginx logs also show affected clients disconnecting before completion (499) and gateway timeouts (504). The number of unique affected users, exact incident start, and exact recovery moment were not established.

# Investigation

## Infrastructure and background jobs

The Mastodon web, Sidekiq, streaming, PostgreSQL, Redis, and Elasticsearch containers were running. System resource snapshots did not support host CPU, memory, or disk exhaustion as the primary explanation.

The active Mastodon database was confirmed as `mastodon_production` in the Docker PostgreSQL 14 container; a separate host PostgreSQL service was not used for these checks.

A sampled `pg_stat_activity` view showed 12 idle Mastodon connections waiting on `ClientRead`. During the 18.53-second API request, repeated snapshots again showed 12 idle connections and one active session consistent with the diagnostic query itself. These samples did not show sustained SQL execution or lock waits, but cannot exclude short-lived database stalls outside the sample windows.

The `conversations` table showed approximately 11.08 million estimated live tuples and 1.89 million estimated dead tuples, with its last recorded autovacuum on 2026-04-24. PostgreSQL 14 autovacuum was enabled with default scale factors. A later check using `pg_class.reltuples` reported:

```text
conversations:
  reltuples estimate:       10,855,141
  n_dead_tup estimate:       1,892,591
  dead-tuple threshold:      2,171,079
  inserts since vacuum:      1,963,263
  insert threshold:          2,172,029
  relfrozenxid age:         46,520,613
```

Neither examined trigger threshold had been reached by these estimates. No manual `VACUUM FULL`, `REINDEX`, or database restart was performed. These table statistics do not establish an account-deletion cause for web latency.

## Puma behavior and request path

The deployment used Puma 8.0.2 with the configured defaults of two workers and five request threads per worker. During a slowdown, both workers were observed consuming approximately one logical CPU each.

Local Nginx and direct Puma requests were both delayed, so an external-network-only or Nginx-only fault was not sufficient to explain the symptoms. TCP socket snapshots also showed connections with multi-megabyte unread/unsent buffers; these indicated backpressure but did not identify which application component initiated the stall.

A diagnostic `SIGPWR` thread dump was taken from one Puma worker after checking that the signal handler was registered. At that instant, all five Puma request-thread backtraces were waiting on `Thread::ConditionVariable#wait`; the reactor and server threads were in their normal event waits. This **single snapshot did not capture the earlier CPU-intensive work**. It does not prove that Puma threads were idle throughout the incident.

Once latency subsided, parallel probes through the host's published Docker port, directly across the Docker bridge, and inside the container all returned HTTP 200 in approximately 2–3 ms. The data do not support a persistent Docker port-forwarding bottleneck.

## Nginx request timing

A 5,000-line Nginx access-log sample showed the following completed-request statistics (times are Nginx `$request_time`, not Rails CPU time):

| Route | Count | Average request time | Requests >=8 s |
| --- | ---: | ---: | ---: |
| `GET /.well-known/webfinger` | 717 | 80.88 s | 709 |
| `POST /inbox` | 1,752 | 11.58 s | 417 |
| `GET /api/v2/instance` | 61 | 16.60 s | 23 |
| `GET /health` | 54 | 18.23 s | 25 |
| `GET /api/v1/timelines/public` | 217 | 16.05 s | 81 |

A separately selected WebFinger sample contained many successful but delayed responses as well as 499 and 504 outcomes. The completed request times and high error counts indicate a severe response-delay episode, but they do not alone identify the CPU-intensive code path.

Rails completion logs captured around the diagnostic dump included short controller durations (roughly 3–33 ms) for unrelated sampled requests. Those logs were not matched one-to-one to the delayed Nginx entries, so a precise upstream-versus-application timing breakdown was not available.

## Repeated WebFinger requests

Within a 20,000-line access-log sample, the largest apparent client source generated:

```text
WebFinger requests:      1,103
Distinct request URLs:       1
Requests >=8 s:          1,043
HTTP 200:                  712
HTTP 499:                  277
HTTP 504:                  114
Mean Nginx request time:  67.9 s
Distinct User-Agents:        8
```

Observed User-Agent strings represented multiple browser/device combinations. This pattern is consistent with automated or proxied repeat requests, but attribution and intent remain unconfirmed; User-Agent is trivially forgeable. The public report intentionally omits the client address, complete query string, and target account identifier.

The first and last *completed* entries for this source in the inspected sample were 2026-10-19 12:44:05 and 14:30:30 UTC. These are not necessarily the actual beginning and end of the traffic. Minute-level completed-request logs showed significant delays and 499/504 responses during the same general period as high Puma CPU. By approximately 14:41 UTC, a later measurement found low worker CPU and fast local API responses.

Cloudflare real-IP restoration was present via trusted proxy ranges and `CF-Connecting-IP`; the apparent source may still represent a shared proxy, so it should not be treated as an established individual or attacker.

A later 10-minute access-log check found only 13 completed WebFinger requests across four apparent sources, with 12 classified as 499/504. This indicated reduced *completed request volume* but not yet a fully healthy request population.

# Root Cause

**Unconfirmed.**

The most relevant correlated observations were:

1. Both Puma workers reached approximately 100% CPU during a period of generalized web latency.
2. A single apparent client source repeatedly requested one WebFinger URL with several User-Agent strings.
3. Long WebFinger request times and 499/504 responses appeared during the degradation.
4. Web response times later normalized while the concentrated traffic was no longer prominent in the inspected sample.

It remains possible that the repeated WebFinger traffic contributed to saturation, that an inefficient or CPU-heavy processing path caused the stalls, or that slow Puma processing amplified client retries. The captured thread dump was taken during an idle interval and did not identify a hot Ruby method.

No evidence established that account deletion or PostgreSQL autovacuum lag was the trigger. No security incident or denial-of-service intent was confirmed.

# Resolution

The only production configuration change made during investigation was to reduce Rails logging from `RAILS_LOG_LEVEL=debug` to `RAILS_LOG_LEVEL=info` in the Mastodon environment file.

After validating the Docker Compose configuration, the operator recreated **only** the web and Sidekiq containers using the existing images. This briefly interrupted those components and reapplied the logging environment variable. Both subsequently reported healthy and `info`.

Two 60-second log-volume snapshots (different traffic intervals) showed combined web/Sidekiq output decreasing from approximately 664 KB/min to 55 KB/min. The logging change is a useful operational improvement but **is not demonstrated to have caused the latency recovery**; significant request delays were observed after the containers were recreated.

No abusive IP block, WebFinger rate limit, queue purge, Sidekiq job deletion, PostgreSQL maintenance, or additional web-worker scaling was applied during this incident.

The severe latency eventually subsided without a confirmed causal fix.

# Verification

After the slowdown, three public HTTPS probes each returned HTTP 200:

| Probe | Observed durations |
| --- | --- |
| `/api/v2/instance` | 0.129 s, 0.112 s, 0.127 s |
| `/.well-known/webfinger` (valid local account lookup) | 0.093 s, 0.109 s, 0.086 s |

Concurrent local tests through the host Docker proxy, Docker bridge, and within the container also completed in approximately 2–3 ms each.

The operator independently confirmed that the home timeline, notifications, profile pages, and overall interface were again opening normally. **Incident status: recovered, with root cause not conclusively determined.**

# Lessons Learned

- A healthy container and modest host load do not rule out application-worker saturation.
- Brief snapshots can show idle Puma threads even after an earlier high-CPU period; sampling must coincide with the slowdown.
- A response delay observed both behind Nginx and through a direct Puma connection is not explained solely by the public network.
- Nginx `$request_time` is elapsed request time, not CPU time. A precise diagnosis needs per-request correlation with upstream timings and application logs.
- Repeated WebFinger requests from one apparent source and varying User-Agent strings warrant investigation but are not proof of malicious activity.
- Completed access-log timestamps are not necessarily request start times; long requests can distort minute-by-minute causal comparisons.
- Old-account deletion should not be inferred from slowdown alone. Unlike SUP-0012, no `pull`-queue backlog was seen here.
- Changes that reduce debug logging are helpful but must not be misrepresented as a verified fix.

# Prevention

- Preserve relevant incident-period Nginx and application logs securely, following retention policy; do not commit raw IPs, account targets, credentials, or live security-control values to this public repository.
- Add a diagnostic Nginx log format containing `request_time`, `upstream_connect_time`, `upstream_header_time`, `upstream_response_time`, response status, and a correlation identifier; validate in staging and keep access to detailed logs restricted.
- Monitor Puma worker CPU, CPU-intensive request threads, health-check latency, and HTTP 499/502/504 rates. Capture thread dumps or a supported profiler sample **while** the stall is occurring.
- Monitor WebFinger requests by normalized route, apparent source, User-Agent variation, and response latency without assuming the source IP uniquely identifies a client.
- If repeat traffic recurs, evaluate narrowly scoped WebFinger protections using dry-run/observation first; preserve normal ActivityPub account discovery and avoid blanket browser challenges.
- Review worker concurrency and Ruby CPU profiling only after measuring the actual hot path; adding workers blindly would not establish or resolve the underlying cause.
- Review autovacuum thresholds and table growth separately as preventive maintenance rather than claiming they explain this incident.
