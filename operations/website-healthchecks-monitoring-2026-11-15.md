# One-Minute Website Availability Check and Healthchecks Alerts (2026-11-15)

## Purpose and outcome

On 2026-11-13, the production Nginx startup failure resulted in a short Cloudflare 521 outage. The existing daily Sidekiq audit ran successfully earlier that day and could not detect the intervening web outage: it is a scheduled Sidekiq/queue check, **not** continuous public-HTTP availability monitoring. This limitation was noticed after no Matrix alert had arrived during that incident.

On **2026-11-15**, the operator added an independent, once-per-minute website probe and a dedicated Healthchecks.io check with **Email** and **Matrix** notification channels enabled.

**Verified:** HTTP 200 from a manual probe and the first systemd-timer-triggered probe, plus Healthchecks success event delivery on both runs. **Not verified:** actual failure-path alert delivery for this production website check, externally independent website reachability, or uninterrupted monitoring over an extended period.

Related records:

- [2026-11-13 Nginx startup/Cloudflare 521 incident](../incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md)
- [Sidekiq daily audit and Healthchecks/Matrix alerts](sidekiq-delivery-retries-and-daily-audit-2026-10-26.md)
- [R2 cache cleanup and its weekly monitoring](cloudflare-r2-media-cleanup-and-weekly-automation-2026-11-15.md)
- [Ubuntu package maintenance and controlled reboot](ubuntu-24-04-package-updates-and-reboot-2026-11-15.md)

## Architecture

| Component | Role |
| --- | --- |
| `mustard-website-monitor.timer` | systemd timer scheduled once per minute, `Persistent=false` |
| `mustard-website-monitor.service` | `Type=oneshot` HTTP probe as `ubuntu`; follow-up notifier executed as root |
| `/usr/local/libexec/mustard-website-http-check` | Checks HTTPS response from the public `https://mustard.blog/` address |
| `/usr/local/libexec/mustard-website-healthchecks-notify` | Separate copy of the tested Sidekiq-style notifier, using its own credential file |
| `/etc/mustard-monitoring/website-healthchecks.url` | Root-protected dedicated Healthchecks Ping URL; **not included** in this record |
| `Mustard Website Monitor` | Dedicated Healthchecks.io check, with Email and existing Matrix destination enabled |

The HTTP probe uses `curl` with **4-second connection timeout**, **10-second overall limit**, HTTPS-only scheme, and requires exactly **HTTP 200**. Network failures and non-200 HTTP statuses (including 521) return a failed exit status. The notifier is hooked by:

```ini
[Service]
ExecStopPost=-+/usr/local/libexec/mustard-website-healthchecks-notify
```

The notifier handles `SERVICE_RESULT=success` with the normal Healthchecks ping, and non-success with a `/fail` ping. The `-+` systemd prefixes allow root-only secret access without overriding the probe's primary exit result if notification fails.

The Healthchecks Check was configured for a **one-minute period** and **two-minute grace**, with both Email and Matrix notifications enabled. A direct `/fail` ping is a failure event and **does not wait for two consecutive failed website checks**. If the host cannot send any ping, Healthchecks may eventually alert on missing signals after the configured period and grace, subject to service-side processing and delivery latency.

This is deliberately independent of:

- `mustard-sidekiq-audit.timer`, which performs a read-only queue/health audit daily and reports to a different Healthchecks check;
- `mustard-media-cache-cleanup.timer`, which handles weekly remote attachment cache cleanup and reports to its own Healthchecks check.

No existing timer, production container, Compose file, Nginx configuration or media object was modified to install the website monitor.

## Installation and evidence

The operator installed the checker's executable, a dedicated notifier derived from the previously working Sidekiq notifier, the restricted Ping URL file, and two systemd units. Syntax checks with `bash -n` and unit checks with `systemd-analyze verify` returned no errors.

The first direct probe, before activating the timer, returned:

```text
WEBSITE_CHECK=OK HTTP=200
```

Notifier dry runs returned the expected success and failure branch messages without sending a real failure ping:

```text
DRY-RUN: Would send success event
DRY-RUN: Would send failure event
```

The operator started the service once manually and then enabled the timer. Journald confirms the initial and first scheduled runs (UTC):

```text
Nov 15 14:02:15 ... WEBSITE_CHECK=OK HTTP=200
Nov 15 14:02:15 ... Healthchecks success event: DELIVERED
Nov 15 14:02:15 ... Finished mustard-website-monitor.service ...
Nov 15 14:03:01 ... WEBSITE_CHECK=OK HTTP=200
Nov 15 14:03:01 ... Healthchecks success event: DELIVERED
Nov 15 14:03:01 ... Finished mustard-website-monitor.service ...
```

The timer's first scheduled event was 2026-11-15 **14:03 UTC** (23:03 JST). It was not necessary to stop Mastodon, force a 521, or trigger a production `/fail` event.

## Limitations and operations

1. **Server-local probe is not a fully independent external probe.** The curl request originates on the monitored server, even though it uses the public hostname. Certain external-only, geography-specific, routing, and CDN issues may not be reflected in its result. A completely failed server can be inferred by Healthchecks only after pings stop and the grace window elapses.
2. **One failed request triggers an explicit failure ping.** Brief network/CDN transients may create false alerts. Do not introduce stateful consecutive-failure handling unless actual alert noise justifies it.
3. **Success event delivered ≠ Matrix failure alert tested.** Existing Matrix/Email channels were previously exercised using separate test checks. The real website-check failure route and recovery route were not deliberately tested against production.
4. **HTTP 200 is a narrow signal.** The check does not validate authenticated sessions, federation, streaming, media retrieval, or content correctness.
5. **Do not expose the dedicated Ping URL** in terminal logs, GitHub, chat, or public status messages.

Minimal read-only investigation for a future alert:

```sh
systemctl list-timers --all 'mustard-*.timer' --no-pager
sudo journalctl -u mustard-website-monitor.service -n 40 --no-pager
systemctl show mustard-website-monitor.service -p Result -p ExecMainStatus
```

Cross-check the Healthchecks event history for signal receipt and Matrix/Email notification state if server journals report `DELIVERED` but a warning did not arrive. Do **not** induce a production outage to validate notifications.

## Final decision

Keep the existing Sidekiq and R2 timers unchanged, leave the website monitor enabled at the current interval, and assess its alert quality from observed incidents rather than broad new testing. This closes the identified gap for many Nginx/521 cases without a new paid monitoring provider, while retaining the documented limits of an in-host probe.
