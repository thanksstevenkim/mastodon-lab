# Production Sidekiq Delivery Retries and Daily Audit Timer (2026-10-26)

## Summary and status

- **Observed on:** 2026-10-26 (UTC/JST).
- **Environment:** production Mastodon 4.7.3, Docker Compose, Sidekiq 8.1.6, Redis.
- **Scope:** read-only queue/retry/dead-set investigation and daily systemd audit installation.
- **Outcome:** six ordinary queues had no pending jobs or observable queue latency at the sampled checkpoints; repeated federation delivery retries were concentrated in a few anonymous destinations; the first **scheduled**, not merely manual, daily audit succeeded at **2026-10-26 01:30:29 UTC**.
- **Not claimed:** complete federation delivery success, root cause of the remote HTTP errors, successful remote signature verification, or an automated alerting system.

The audit implementation does **not** clear Redis, purge retries, delete dead jobs, force retries, restart Sidekiq, or mutate production Mastodon records.

## Initial health observations

At approximately 00:05 UTC, the Sidekiq container was `healthy`, with one Sidekiq process, zero enqueued jobs, zero sampled busy workers, and zero size/latency for each of `default`, `ingress`, `mailers`, `pull`, `push`, and `scheduler`. The stored counters showed:

| Metric | Observation |
| --- | ---: |
| Cumulative processed | 13,877,979 |
| Cumulative failed executions | 1,320,791 |
| Retry set | 469 |
| Dead set | 560 |
| Scheduled | 22 |

A cumulative failure counter counts failed executions, including repeat attempts; it is **not** the current number of distinct failed jobs and should not be treated as a per-job failure rate.

Historical daily failed-execution totals (UTC) included **7,876 on Oct 23** and **10,039 on Oct 24**, versus **1,473 on Oct 20**. This spike motivated further investigation rather than a queue purge.

## Retry and dead-set investigation

A read-only class/error aggregation identified mostly `ActivityPub::DeliveryWorker` jobs in the retry set. Observed retry errors included `Mastodon::UnexpectedResponseError`, `Stoplight::Error::RedLight` (circuit breaker), and rare timeouts.

Current retries varied between samples because Sidekiq continued processing jobs. At the 00:38 UTC snapshot there were **439 delivery retries across four distinct parsed destination hosts** (reported below as anonymous ranks only):

| Anonymous destination | Jobs | Recorded last-error distribution |
| --- | ---: | --- |
| #1 | 392 | Circuit breaker 209; HTTP 502 131; HTTP 500 50; HTTP 530 1; timeout 1 |
| #2 | 39 | HTTP 401 (39) |
| #3 | 7 | HTTP 401 (7) |
| #4 | 1 | Timeout (1) |

The ranks are **within-snapshot only**; no destination names, inbox URLs, account IDs, or activity payloads were recorded in this public document. These results suggest repeated remote endpoint failures, but do not prove that the local sender, remote application, proxy, network, or signing implementation caused the HTTP responses.

At 00:45 UTC, **432** current delivery retries involved **three distinct local source accounts**; **427** of the 432 were from one account. The top destination contained deliveries from all three source accounts. The two HTTP 401 destinations only appeared under the busiest source account in that snapshot. Account checks at a later snapshot found that each source account existed, was local, was not suspended or permanently unavailable, and had one non-revoked unexpired keypair. The legacy private-key field was empty in all three records; keypair existence alone does **not** verify successful outbound HTTP signing or remote acceptance.

`ActivityPub::DeliveryWorker` reported effective Sidekiq options `queue: "push"`, `retry: 16`, `dead: false`. Many current retries were near the exhaustion limit, so disappearance from the retry set cannot be interpreted as confirmed delivery: work can succeed, finish without delivery under application logic, or exhaust retries without entering the dead set.

The 560 dead jobs were separate from this delivery retry concentration. Their historical errors included media-download timeouts and S3-compatible multipart upload errors. The **124** observed `Aws::S3::MultipartUploadError` dead entries had last failure dates distributed from August through **2026-10-19**. Their presence does not demonstrate that a current Cloudflare R2 recovery task caused the Oct 23–24 retry spike. The last-failure date is not necessarily the first-failure date.

### Timestamp analysis correction

The first attempt to group `failed_at` misinterpreted millisecond timestamps as seconds and produced impossible dates in the year 58xxx. This was an **analysis-script error**, not a Sidekiq clock defect. The corrected query used the Sidekiq job's `failed_at` and `retried_at` API methods. Of the **446** delivery jobs in that corrected snapshot, first failure dates were Oct 23 (**162**), Oct 24 (**201**), and Oct 25 (**83**) UTC. Those groups represent **jobs still in Retry at that moment**, not every failure from those dates.

## Daily audit installation and verification

The operator installed the following root-owned files, keeping the timer **disabled** until the manual validation passed:

- `/usr/local/libexec/mustard-sidekiq-audit`: fail-fast, read-only Bash audit, executed with an unprivileged deploy user.
- `mustard-sidekiq-audit.service`: a `Type=oneshot` systemd unit, journal output, five-minute startup timeout.
- `mustard-sidekiq-audit.timer`: `OnCalendar=*-*-* 01:30:00 UTC`, `AccuracySec=1min`, `Persistent=true`.

The audit checks Docker container `running/healthy` and reads Sidekiq cumulative counters, Retry/Dead/Scheduled size, process/busy-worker counts, per-queue size/latency, and the last three UTC daily processing/failure totals via Sidekiq's API.

**STEP 10A–10B:** Host identity, Docker, Compose, systemd/NTP, and path/unit collisions were checked. `bash -n`, `systemd-analyze calendar`, and `systemd-analyze verify` passed. Files were installed and the timer was deliberately left `disabled/inactive`.

**STEP 10C (manual):** `systemctl start mustard-sidekiq-audit.service` succeeded. `Result=success`, `ExecMainStatus=0`, the audit completion marker, and journal output were confirmed. The oneshot service correctly returned to `inactive/dead`; the timer remained disabled.

**STEP 10D (activation):** The timer was enabled and started with `systemctl enable --now`; state was `enabled`, `active (waiting)`, `Persistent=yes`, targeting the expected service and calendar event.

**STEP 10E (first scheduled run):** journald recorded the timer-triggered audit at **2026-10-26T01:30:29Z**, with successful service completion. The next reported trigger was **2026-10-27 01:30 UTC**. The scheduled audit reported:

| Metric | Scheduled sample |
| --- | ---: |
| Container | running/healthy |
| Process / busy worker | 1 / 0 |
| Enqueued | 0 |
| Retry | 416 |
| Dead | 560 |
| Scheduled | 20 |
| Processed total | 13,881,239 |
| Failed-execution total | 1,320,869 |
| Queue sizes / observed latency | 0 / 0.0 s for all six queues |

The prior manual sample had **430** retries. The later **416** is a shrinking snapshot, **not** proof of 14 successful remote deliveries.

## Operation and recovery

Inspect the timer and the latest audit without altering job state:

```bash
systemctl status mustard-sidekiq-audit.timer --no-pager
systemctl list-timers --all mustard-sidekiq-audit.timer --no-pager
sudo journalctl -u mustard-sidekiq-audit.service -b -n 100 --no-pager
systemctl show mustard-sidekiq-audit.service -p Result -p ExecMainStatus
```

If the audit fails, inspect journal errors, Docker/Compose access, application health, and Redis connectivity before changing jobs. A failure in the audit is not itself proof of user-visible Mastodon downtime. For temporary suspension of **monitoring only**, an operator may use `sudo systemctl disable --now mustard-sidekiq-audit.timer`; this does **not** stop the Sidekiq service. Reactivation is a separate, deliberate decision.

The current installation produces **journald records only**: there is no configured outbound notification, dashboard, queue-latency alert threshold, or independently verified alert delivery. Journal retention is governed by the host's existing journald policy. Monitoring must be reviewed to become actionable.

## Conclusions and follow-up

1. Prefer observation of queue latency and service health over periodic clearing of Retry/Dead sets.
2. Distinguish remote 5xx/timeout/circuit-breaker responses from persistent 401 responses; do not attribute all failures to signing or to storage without direct evidence.
3. Respect delivery retry exhaustion (`retry: 16`, `dead: false`); a falling Retry count is not a delivery-success metric.
4. Keep the monitoring script read-only and do not automatically restart containers, retry all jobs, delete queues, or flush Redis.
5. Evaluate a **separate**, tested notification mechanism and periodic review of the timer's journal; those are future work, not part of this verified deployment.
6. Reassess HTTP 401 destinations only if needed, with privacy-safe diagnostics and a distinction between local signature generation and remote acceptance.

Related: [earlier pull-queue backlog after account deletion](../incidents/012-sidekiq-pull-queue-backlog-after-account-deletion.md). That incident involved a large temporary `pull` backlog; the present investigation involved mostly `push` delivery retries with **empty ordinary queues**. They must not be conflated.

This record omits raw request/response bodies, specific remote destinations, source account identifiers, private keys, tokens, and secrets.
