# Ticket ID

SUP-0010

# Title

Automated registration abuse using BoomProtocolProbe

# Severity

Medium

- Production service remained operational
- Large numbers of automated registrations accumulated in the pending-user queue
- Hundreds of OAuth applications were created automatically
- Administrative review was disrupted by abusive registrations
- No evidence of server compromise was identified

# Environment

- Mastodon 4.6.6
- Rails 8.1.3
- Docker Compose
- Nginx
- Cloudflare
- PostgreSQL
- Redis
- Sidekiq
- Elasticsearch
- Custom Mastodon fork

# Issue

A large number of pending accounts appeared in the Mastodon administration interface.

The accounts shared several characteristics:

- randomized usernames beginning with patterns such as `bp`
- signup reason:
  `Automated protocol deliverability probe`
- signup application:
  `BoomProtocolProbe`
- no confirmed email addresses
- no normal account activity

The activity was traced to repeated creation of OAuth applications named:

```text
BoomProtocolProbe
```

Each application was then used to create a pending Mastodon account.

The behavior was consistent with an automated client or registration script rather than interactive human use.

# Impact

The Mastodon service itself remained available.

However:

- hundreds of automated registrations were added to the pending-user queue
- administrative review became difficult because legitimate registrations were mixed with abusive registrations
- hundreds of unnecessary OAuth applications accumulated in the database
- the Signup Review Bot did not create review cards for many of the accounts because they did not confirm their email addresses
- existing signup IP records were initially not useful for identifying client origins because Nginx was recording Cloudflare edge addresses

At the peak of the incident, database inspection identified:

```text
419 BoomProtocolProbe OAuth applications
344 users created through those applications
344 pending users
0 confirmed users
```

A separate legitimate pending user was not associated with the probe and was reviewed and approved normally.

# Investigation

## Initial detection

The incident was first noticed through the Mastodon administration dashboard.

A large increase in new and pending users was visible, and nearly all suspicious registrations reported the same source:

```text
BoomProtocolProbe
```

An earlier dashboard snapshot showed:

```text
273 new users
302 pending users
272 registrations from BoomProtocolProbe
```

The volume continued increasing during the investigation.

## OAuth application creation

Database inspection showed that `BoomProtocolProbe` was not a single OAuth application being reused.

Instead, hundreds of separate Doorkeeper applications had been registered with the same name.

Example investigation:

```ruby
apps = Doorkeeper::Application.where(name: "BoomProtocolProbe")

apps.count
```

The count continued growing while the incident was active.

The final pre-cleanup snapshot showed:

```text
applications: 419
```

This repeated creation of independent OAuth applications strongly indicated programmatic registration activity.

## Linking registrations to OAuth applications

Users were correlated with the suspicious applications using:

```ruby
apps = Doorkeeper::Application.where(name: "BoomProtocolProbe")
app_ids = apps.pluck(:id)

users = User.where(created_by_application_id: app_ids)
```

The final pre-cleanup result was:

```text
applications: 419
users: 344
pending: 344
confirmed: 0
last_application: 2026-09-10 14:39:45 UTC
last_user: 2026-09-10 14:37:59 UTC
```

All 344 accounts linked to `BoomProtocolProbe` were unapproved and had not confirmed their email addresses.

## Registration timeline

The activity occurred in bursts between September 8 and September 10, 2026.

Observed user creation counts included:

```text
2026-09-08 13:00 UTC => 1
2026-09-08 19:00 UTC => 69
2026-09-08 20:00 UTC => 28
2026-09-08 21:00 UTC => 8

2026-09-09 13:00 UTC => 18
2026-09-09 14:00 UTC => 45
2026-09-09 15:00 UTC => 37
2026-09-09 16:00 UTC => 1
2026-09-09 17:00 UTC => 7
2026-09-09 18:00 UTC => 34
2026-09-09 19:00 UTC => 23
2026-09-09 20:00 UTC => 1

2026-09-10 03:00 UTC => 6
2026-09-10 04:00 UTC => 11
2026-09-10 05:00 UTC => 4
2026-09-10 06:00 UTC => 2
2026-09-10 07:00 UTC => 2
2026-09-10 10:00 UTC => 3
```

Activity later continued until approximately:

```text
Last suspicious user:
2026-09-10 14:37:59 UTC

Last BoomProtocolProbe application:
2026-09-10 14:39:45 UTC
```

No fixed scheduling pattern was established.

## Email domains

Submitted email addresses used a number of common Japanese mail domains.

The most frequently observed submitted domains included:

```text
docomo.ne.jp   => 195
ezweb.ne.jp    => 34
gmail.com      => 20
yahoo.co.jp    => 14
icloud.com     => 12
sensinan.co.jp => 9
me.com         => 5
i.softbank.jp  => 5
```

These values only represent domain strings supplied during registration.

The investigation did not establish whether the submitted mailboxes actually existed or belonged to legitimate users.

## Email confirmation

None of the 344 users linked to `BoomProtocolProbe` had confirmed their email address.

Final verification before cleanup:

```text
confirmed: 0
```

This also explained why many accounts did not generate Signup Review Bot review cards.

The bot waits for email confirmation before posting a review card, while the unconfirmed account can remain visible as pending in Mastodon.

## Signup IP investigation

Initial `sign_up_ip` values included addresses such as:

```text
172.64.215.34
162.159.110.36
172.64.213.74
162.159.108.32
172.71.8.34
```

These were Cloudflare edge/proxy addresses rather than reliable client-origin addresses.

Blocking these IP addresses would therefore have risked blocking legitimate Cloudflare traffic.

Nginx did not have Cloudflare real-IP restoration configured at the time.

## Restoring client IP addresses

Nginx was confirmed to include the `http_realip_module`.

A Cloudflare real-IP configuration was added using only Cloudflare's proxy ranges:

```nginx
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;

set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
```

The configuration passed:

```bash
sudo nginx -t
```

and Nginx was reloaded successfully.

After the change, access logs began showing apparent client-origin addresses instead of Cloudflare edge addresses.

## Automated client observations

After real-IP restoration, suspicious requests to registration-related endpoints were observed from multiple distinct client IP addresses.

Examples included:

```text
POST /oauth/token
POST /api/v1/apps
POST /api/v1/accounts
```

Observed suspicious registration requests used the User-Agent:

```text
Python/3.10 aiohttp/3.14.3
```

This supported the assessment that the registrations were being produced by an automated client.

However, the User-Agent is trivial to change and was treated only as an indicator, not as a durable identity.

The investigation did not establish whether the multiple IP addresses represented proxies, a botnet, compromised hosts, or another distributed infrastructure.

# Evidence Preservation

Current Nginx logs were copied before cleanup:

```bash
sudo cp /var/log/nginx/access.log ~/boom-protocol-probe-access.log
sudo cp /var/log/nginx/error.log ~/boom-protocol-probe-error.log
```

The copied current access log began on September 10 UTC and therefore did not contain all activity from September 8 and September 9.

Before destructive database cleanup, a full PostgreSQL dump was created:

```bash
docker compose exec -T db \
  pg_dump -U postgres -d mastodon_production \
  > ~/backups/incidents/SUP-0010/mastodon_production-before-cleanup.sql
```

The resulting plain SQL dump was approximately 11 GB.

A SHA-256 checksum was also recorded:

```bash
sha256sum ~/backups/incidents/SUP-0010/mastodon_production-before-cleanup.sql \
  | tee ~/backups/incidents/SUP-0010/mastodon_production-before-cleanup.sha256
```

# Mitigation

## Per-IP registration rate limiting

Nginx rate-limit zones were first added for the two registration endpoints:

```nginx
limit_req_zone $binary_remote_addr zone=mastodon_app_registration:10m rate=2r/m;
limit_req_zone $binary_remote_addr zone=mastodon_account_registration:10m rate=2r/m;
```

The following endpoint-specific limits were applied:

```nginx
location = /api/v1/apps {
  limit_req zone=mastodon_app_registration burst=3 nodelay;
  limit_req_status 429;
  try_files $uri @proxy;
}

location = /api/v1/accounts {
  limit_req zone=mastodon_account_registration burst=3 nodelay;
  limit_req_status 429;
  try_files $uri @proxy;
}
```

The configuration passed `nginx -t` and was successfully reloaded.

However, subsequent requests arrived from multiple distinct client IP addresses.

As a result, a per-IP limit alone did not materially stop the activity.

## Global registration rate limiting

Additional endpoint-wide rate limits were introduced:

```nginx
limit_req_zone $server_name zone=mastodon_app_registration_global:10m rate=2r/m;
limit_req_zone $server_name zone=mastodon_account_registration_global:10m rate=2r/m;
```

They were combined with the existing per-IP limits:

```nginx
location = /api/v1/apps {
  limit_req zone=mastodon_app_registration burst=3 nodelay;
  limit_req zone=mastodon_app_registration_global burst=3 nodelay;
  limit_req_status 429;
  try_files $uri @proxy;
}

location = /api/v1/accounts {
  limit_req zone=mastodon_account_registration burst=3 nodelay;
  limit_req zone=mastodon_account_registration_global burst=3 nodelay;
  limit_req_status 429;
  try_files $uri @proxy;
}
```

The observed request rate was sufficiently low that requests could still fit within the configured rate and burst allowance.

Therefore, absence of HTTP 429 responses did not indicate a broken rate-limit configuration.

The rate limits were retained as defense-in-depth rather than considered a complete solution to this specific incident.

# Cleanup

After the automated registrations stopped, a final pre-cleanup database snapshot was taken:

```text
applications: 419
users: 344
pending: 344
confirmed: 0
last_application: 2026-09-10 14:39:45 UTC
last_user: 2026-09-10 14:37:59 UTC
```

The 344 suspicious accounts were selected specifically by their `created_by_application_id`.

This avoided deleting an unrelated legitimate pending registration.

The suspicious accounts were not removed using direct SQL or `delete_all`.

Instead, cleanup followed Mastodon's account rejection/deletion path:

```ruby
account.suspend!(origin: :local)

AccountDeletionWorker.perform_async(
  account.id,
  { "reserve_username" => false }
)
```

The accounts were processed in batches of 50 so that Sidekiq and the administration interface could be monitored between batches.

The first test batch reduced the pending count from:

```text
345
```

to:

```text
295
```

confirming that exactly 50 selected accounts had been removed.

The remaining `BoomProtocolProbe` accounts were then processed in additional batches.

One unrelated legitimate pending user was reviewed separately and approved.

After all suspicious users had been removed, the remaining OAuth applications were deleted:

```ruby
Doorkeeper::Application
  .where(name: "BoomProtocolProbe")
  .destroy_all
```

A total of:

```text
419 OAuth applications
```

were removed.

# Verification

Post-cleanup database verification returned:

```text
applications: 0
remaining_probe_users: 0
pending_total: 0
```

Direct verification of the OAuth application count also returned:

```ruby
Doorkeeper::Application.where(name: "BoomProtocolProbe").count
```

Result:

```text
0
```

A sample of the latest Nginx access log was checked for new registration requests:

```bash
sudo tail -n 200 /var/log/nginx/access.log \
  | grep -E '"POST /api/v1/(apps|accounts)'
```

No matching requests were present in the sampled log after cleanup.

At that point, the incident was considered contained and cleanup complete.

Continued monitoring remained necessary because indicators such as the OAuth application name and User-Agent can be changed easily.

# Root Cause

The immediate cause was automated use of Mastodon's public client-registration and account-registration API.

The automated client repeatedly:

1. registered a new OAuth application named `BoomProtocolProbe`
2. obtained authorization through the OAuth flow
3. submitted a new account registration
4. left the resulting account unconfirmed and pending

The server permitted public OAuth application registration and account signup as expected by Mastodon.

The incident therefore did not demonstrate exploitation of a Mastodon vulnerability or unauthorized access to the server.

Two infrastructure conditions made investigation and mitigation more difficult:

- Nginx initially did not restore the original client IP from Cloudflare
- per-IP rate limiting alone was ineffective against requests arriving from multiple distinct IP addresses

The identity, infrastructure, and precise purpose of the actor were not established.

# What Was Not Confirmed

The investigation did not establish:

- server compromise
- exploitation of a Mastodon vulnerability
- unauthorized administrative access
- database access by the remote client
- a specific attacker or organization
- whether the source IP addresses belonged to proxies, VPNs, botnets, compromised hosts, or ordinary endpoints
- whether the submitted email addresses represented real mailboxes
- the precise purpose of the automated probe

The most accurate description is therefore:

> An automated client repeatedly registered new OAuth applications named `BoomProtocolProbe`, then used those applications to create large numbers of pending accounts.

# Follow-up

- Keep Cloudflare real-IP restoration enabled
- Periodically verify Cloudflare trusted proxy ranges against Cloudflare's published ranges
- Keep registration endpoint rate limiting enabled and monitor its effect on legitimate clients
- Review rate-limit values if legitimate application registration is affected
- Monitor `/api/v1/apps` and `/api/v1/accounts` for unusual registration bursts
- Monitor OAuth application creation volume as well as user signup volume
- Do not rely on application names or User-Agent strings as permanent blocking indicators
- Preserve rotated Nginx logs when responding to future incidents
- Consider alerting on unusual rates of OAuth application creation
- Consider documenting a repeatable incident-response query for accounts grouped by `created_by_application_id`
- Keep destructive account cleanup behind an incident-specific database backup
- Prefer Mastodon's own deletion workers/services over direct database deletion

# Lessons Learned

- Pending-user volume alone does not show how an automated registration campaign is operating; OAuth application creation should also be inspected.
- `created_by_application_id` is a useful way to correlate registrations with the client application that created them.
- Multiple OAuth applications sharing the same unusual name can be a strong indicator of automated client behavior.
- Email confirmation state is useful for distinguishing incomplete automated registrations from active accounts.
- Cloudflare edge IP addresses must not be mistaken for origin client IP addresses.
- When Mastodon is behind Cloudflare, Nginx real-IP restoration should be configured before relying on IP-based logging or rate limiting.
- Trusted real-IP sources must be restricted to Cloudflare ranges rather than trusting arbitrary forwarded headers.
- Historical `sign_up_ip` records are not corrected retroactively after fixing proxy IP handling.
- Per-IP rate limiting is insufficient when an automated client uses multiple source IP addresses.
- Global endpoint rate limiting can provide additional protection, but low-rate automation may remain below configured thresholds.
- User-Agent strings are useful temporary indicators but are not reliable long-term controls.
- Avoid blocking Cloudflare edge IP addresses in response to apparent abusive traffic.
- Preserve logs and database state before destructive cleanup.
- A full database backup provides a recovery point, although smaller incident-specific exports may be more practical for future investigations.
- Test destructive cleanup on a small batch before processing the full set.
- Filter abusive accounts using evidence specific to the incident instead of deleting all pending registrations.
- Use Mastodon's account deletion services and workers instead of direct SQL deletion.
- Separate suspicious-account cleanup from OAuth-application cleanup and verify each stage independently.
- A contained incident does not imply attribution: observed automation, source IPs, and client identifiers should not be used to make unsupported claims about who operated the system.
