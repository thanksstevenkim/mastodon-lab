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

# Recurrence — 2026-09-15 to 2026-09-16

Several days after the initial cleanup, automated registrations associated with
`BoomProtocolProbe` appeared again.

The registrations showed the same indicators observed during the original incident:

- randomized usernames beginning with patterns such as `bp`
- signup reason: `Automated protocol deliverability probe`
- signup application: `BoomProtocolProbe`

At the time of detection, the Mastodon administration dashboard showed:

```text
BoomProtocolProbe => 13 registrations
```

Unlike the initial incident, the recurrence occurred at a relatively low rate
over a longer period.

This demonstrated a limitation of the existing Nginx rate limits.

The per-IP and global registration rate limits remained useful against bursts,
but low-rate automated requests could remain below the configured thresholds.

As a result, lowering the rate limits further was not considered an appropriate
primary mitigation because sufficiently strict global limits could also interfere
with legitimate OAuth application registration.

Environment during recurrence:

- Mastodon 4.7.2
- Custom Mastodon fork
- Docker Compose
- Nginx
- Cloudflare

## OAuth application name blocklist

A configurable OAuth application-name blocklist was added to the Mastodon fork.

The blocklist is configured through:

```text
BLOCKED_OAUTH_APP_NAMES=BoomProtocolProbe
```

Blocking is enforced at two points:

1. creation of a new OAuth application through `/api/v1/apps`
2. account registration through an already-existing blocked OAuth application

This prevents both new applications using the blocked name and previously-created
applications with that name from being used for additional registrations.

The implementation was merged in:

```text
thanksstevenkim/mastodon-v2#4
Add OAuth application name blocklist
```

The implementation was tested with:

```text
29 examples, 0 failures
```

RuboCop verification returned:

```text
6 files inspected, no offenses detected
```

The blocklist is intended as an incident-specific mitigation and not as a complete
anti-automation mechanism.

OAuth application names are controlled by clients and can be changed easily.
The existing Nginx registration rate limits therefore remain enabled as an
additional layer of protection.

## Recurrence cleanup

The pending accounts associated with the recurrence were reviewed and removed.

As with the initial cleanup, the suspicious accounts were not deleted directly
from PostgreSQL.

Cleanup followed Mastodon's own account deletion path using account suspension
and `AccountDeletionWorker`.

The remaining `BoomProtocolProbe` OAuth applications associated with the
recurrence were also removed.

The cleanup was limited to registrations associated with the known
`BoomProtocolProbe` applications so that unrelated pending registrations would
not be affected.

## Production deployment

After the implementation and tests were completed, the OAuth application-name
blocklist was deployed to the production Mastodon environment.

The production environment configuration is stored in:

```text
/opt/mastodon/.env.mastodon
```

The following value was added:

```env
BLOCKED_OAUTH_APP_NAMES=BoomProtocolProbe, dialect_signup_v1
```

The Mastodon containers were then recreated from `/opt/mastodon` using:

```bash
docker compose up -d
```

This applied the updated application code and environment configuration to the
running production containers.

The production mitigation now blocks configured OAuth application names at both:

1. OAuth application creation through `/api/v1/apps`
2. account registration through an existing blocked OAuth application

The recurrence cleanup and production deployment were completed successfully.

## Production verification

Production verification was performed after the deployment.

A test request attempted to create an OAuth application using the blocked name:

```text
BoomProtocolProbe, dialect_signup_v1
```

Nginx recorded the request as:

```text
"POST /api/v1/apps HTTP/2.0" 403
```

This confirmed that the blocklist was actively rejecting the application
registration request in production.

The running Mastodon `web` container was also checked from:

```text
/opt/mastodon
```

using:

```bash
docker compose exec web printenv BLOCKED_OAUTH_APP_NAMES
```

The container returned:

```text
BoomProtocolProbe, dialect_signup_v1
```

confirming that the production environment variable had been loaded successfully.

Together, these checks verified that:

1. the running `web` container loaded `BLOCKED_OAUTH_APP_NAMES`
2. a blocked OAuth application name was rejected with HTTP 403
3. the production mitigation was active after container recreation

Existing Nginx per-IP and global registration rate limits remain in place as
defense-in-depth.

The application-name blocklist should not be treated as attribution or as a
general-purpose anti-bot mechanism. If the automated client changes its
application name, additional investigation and mitigation may be required.

## Further recurrence — randomized and generic OAuth application names

A further recurrence was observed on 2026-09-16 UTC.

Unlike the earlier `BoomProtocolProbe` activity, the new registrations no longer
used a single fixed OAuth application name.

Four pending accounts were identified with the same registration reason used in
the earlier incident:

```text
Automated protocol deliverability probe
```

The accounts were linked to the following OAuth applications:

```text
11216  sf-probe-114ba7c5
11217  sf-probe-13e406a5
11218  sf-probe-1fa94d36
11219  Mastodon Web App
```

Three of the applications used randomized names beginning with `sf-probe-`,
while one used the generic-looking name `Mastodon Web App`.

All four accounts were:

- unconfirmed
- unapproved
- pending moderator review
- created through `POST /api/v1/accounts`
- associated with the same signup reason:
  `Automated protocol deliverability probe`

The OAuth applications were created only a few seconds before their associated
accounts:

```text
19:15:54  OAuth app 11216 created
19:16:01  associated account created

20:29:32  OAuth app 11217 created
20:29:35  associated account created

20:33:31  OAuth app 11218 created
20:33:34  associated account created

21:07:11  OAuth app 11219 created
21:07:16  associated account created
```

All timestamps above are UTC.

### Source IP separation

Nginx logs showed that OAuth application creation and account registration were
performed from different apparent client IP addresses.

For example:

```text
124.159.225.211  POST /api/v1/apps      -> app 11216
126.142.114.47   POST /api/v1/accounts  -> associated account

195.138.118.41   POST /api/v1/apps      -> app 11217
193.33.237.115   POST /api/v1/accounts  -> associated account

143.137.167.42   POST /api/v1/apps      -> app 11218
95.164.233.120   POST /api/v1/accounts  -> associated account

58.3.238.102     POST /api/v1/apps      -> app 11219
219.104.163.85   POST /api/v1/accounts  -> associated account
```

The application-registration and account-registration requests occurred only
seconds apart, but originated from different apparent client IP addresses.

This makes simple per-IP correlation less useful for identifying the full
registration workflow.

The logs do not establish whether the differing addresses were caused by
proxies, VPNs, multiple hosts, a botnet, or another network architecture.

### User-Agent change

The earlier activity had been observed using:

```text
Python/3.10 aiohttp/3.14.3
```

The later recurrence instead presented the following browser-like User-Agent:

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
AppleWebKit/537.36 (KHTML, like Gecko)
Chrome/126.0.0.0 Safari/537.36
```

The User-Agent string alone does not establish that a real interactive browser
was used.

### Effect on the OAuth application-name blocklist

The existing mitigation used an exact, case-insensitive OAuth application-name
blocklist.

At the time of this recurrence, the configured blocked application names included:

```text
BoomProtocolProbe
dialect_signup_v1
```

Because the new applications used randomized or generic names such as:

```text
sf-probe-114ba7c5
sf-probe-13e406a5
sf-probe-1fa94d36
Mastodon Web App
```

they did not match the existing exact-name blocklist.

This recurrence demonstrated a limitation of application-name-based blocking:
application names are controlled by the registering client and can be changed
without altering the rest of the registration workflow.

### Stable signup-reason indicator

Despite the changes to OAuth application names, apparent client IP addresses,
and User-Agent strings, the signup reason remained unchanged:

```text
Automated protocol deliverability probe
```

### Signup-reason blocklist deployment and verification

A configurable exact-match signup-reason blocklist was added and deployed as
an additional application-level mitigation.

Production was configured with:

```text
BLOCKED_SIGNUP_REASONS=Automated protocol deliverability probe
```

The running Mastodon `web` container was confirmed to have loaded the
environment variable successfully.

The application-level matcher was also verified directly in production:

```text
SignupReasonBlocklist.blocked?("Automated protocol deliverability probe")
=> true
```

An end-to-end registration test was then performed using a temporary OAuth
application and client-credentials token.

A `POST /api/v1/accounts` request containing:

```text
reason=Automated protocol deliverability probe
```

was rejected with:

```text
HTTP 403
```

A subsequent database check confirmed that no user account was created by the
blocked registration attempt.

Nginx access logs also recorded the test request as an HTTP 403 response.

The temporary OAuth application used for verification was removed after the
test.

Production verification therefore confirmed all of the following:

1. `BLOCKED_SIGNUP_REASONS` was loaded by the running `web` container.
2. `SignupReasonBlocklist` matched the configured reason.
3. The actual `/api/v1/accounts` endpoint rejected the request with HTTP 403.
4. No user account was created by the rejected request.

This check is performed by `AppSignUpService` before the user and access token
are created.

The existing OAuth application-name blocklist remains in place as a separate
defense-in-depth control.

### Cleanup

The four pending accounts were first reviewed and matched to OAuth application
IDs `11216` through `11219`.

All four were confirmed to be:

- unapproved
- unconfirmed
- associated with the known probe signup reason

The accounts were removed through Mastodon's normal account-deletion workflow
using account suspension followed by `AccountDeletionWorker`.

Direct PostgreSQL deletion was not used.

After account deletion completed, the four associated OAuth applications were
removed separately.

Deletion of the applications also removed their associated Doorkeeper access
tokens and access grants.

Final verification returned:

```text
remaining_users: 0
remaining_apps: 0
pending_total: 0
```

The cleanup was therefore completed successfully.

### Assessment

The later recurrence showed that fixed OAuth application names should not be
treated as stable identifiers for this activity.

The observed workflow changed multiple superficial attributes:

- OAuth application names were randomized or made generic
- application creation and account registration used different apparent IPs
- the User-Agent changed from a Python HTTP client to a browser-like string

However, the signup reason remained stable across the observed registrations.

The incident response therefore shifted from relying primarily on known OAuth
application names toward layered controls that also include:

- signup-reason blocking
- OAuth application-name blocking
- per-IP and global registration rate limits
- approval-based registration
- moderator review and Signup Review Bot notifications

These controls remain defense-in-depth measures rather than proof of attacker
identity or a complete prevention mechanism.

## Post-mitigation OAuth application spray — 2026-09-17 to 2026-09-18

After the signup-reason blocklist was deployed, further automated-looking OAuth
application registration activity continued.

Unlike the earlier recurrence, these applications did not use the fixed
`BoomProtocolProbe` name or the randomized `sf-probe-*` pattern.

Instead, generic application names were repeatedly used, including:

```text
Web
Mastodon
mastodon
Mastodon Web
Mastodon Web App
Mastodon Client
Mastodon for Web
Fediverse
```

Despite the varying names, database inspection identified 102 OAuth applications
sharing the same application fingerprint:

```text
redirect_uri: urn:ietf:wg:oauth:2.0:oob
website: https://example.com
scopes: read write
confidential: true
```

No users were linked to these 102 applications.

### Access-token acquisition

Of the 102 applications, 95 obtained exactly one access token.

All 95 tokens had:

```text
resource_owner_id: nil
```

This indicates application-level credentials rather than tokens associated with
an authenticated Mastodon user.

Timing analysis showed that token issuance occurred shortly after the associated
OAuth application was created:

```text
applications with tokens: 95
minimum delay:             0.54 seconds
median delay:              2.19 seconds
maximum delay:            10.24 seconds
```

The repeated application creation followed by credential acquisition within
seconds strongly indicates an automated OAuth application-registration and
credential-acquisition workflow.

Seven applications in the group did not have an associated access token:

```text
11220
11232
11236
11265
11277
11279
11280
```

### Account-registration attempts

Nginx logs for September 17 and September 18 showed:

```text
94 POST /api/v1/accounts requests returning HTTP 403
```

One of these requests was a manual `curl` verification performed during the
incident response.

The remaining 93 requests used the same browser-like User-Agent observed during
the previous recurrence:

```text
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
AppleWebKit/537.36 (KHTML, like Gecko)
Chrome/126.0.0.0 Safari/537.36
```

The account-registration requests occurred during the same periods in which
matching OAuth applications and application-level access tokens were being
created.

Examples include:

```text
2026-09-18 03:03:06 UTC  OAuth application created
2026-09-18 03:03:08 UTC  POST /api/v1/accounts -> 403

2026-09-18 08:22:25 UTC  OAuth application created
2026-09-18 08:22:26 UTC  POST /api/v1/accounts -> 403
```

The exact access token used for each HTTP request was not logged, so individual
requests cannot be directly tied to individual applications from the available
Nginx evidence.

However, the repeated application creation, rapid token issuance, matching time
windows, common application fingerprint, identical browser-like User-Agent, and
lack of successfully created users strongly support the assessment that the
applications were part of the same automated registration workflow.

The observed HTTP 403 responses are also consistent with the deployed
signup-reason blocklist preventing the account-creation stage.

### OAuth application fingerprint blocklist

Because OAuth application names had already changed during the incident, an
additional block was implemented for the observed OAuth application fingerprint.

The blocked fingerprint is:

```text
redirect_uri: urn:ietf:wg:oauth:2.0:oob
website: https://example.com
scopes: read write
confidential: true
```

The implementation was merged in:

```text
thanksstevenkim/mastodon-v2#5
Block known automated OAuth registration fingerprint
```

The fingerprint is enforced at two stages:

1. `POST /api/v1/apps` rejects matching applications before they are persisted.
2. `AppSignUpService` rejects account creation through an already-existing
   application with the same fingerprint.

The matcher normalizes redirect URI and scope values, including ordering and
duplicate values, and normalizes website case and trailing slashes so that
trivial representation changes do not bypass the exact fingerprint match.

The implementation remains an incident-specific indicator control rather than a
general-purpose bot-detection mechanism.

A client can change one or more fingerprint fields and produce a different
application fingerprint.

### Production verification

After the implementation passed CI and was deployed, all three application-level
controls were verified from the production Mastodon `web` container:

```text
OAuthApplicationNameBlocklist         => true
SignupReasonBlocklist                 => true
OAuthApplicationFingerprintBlocklist  => true
```

An end-to-end request was then sent to:

```text
POST /api/v1/apps
```

using:

```text
client_name: FingerprintBlockTest
redirect_uris: urn:ietf:wg:oauth:2.0:oob
scopes: read write
website: https://example.com
```

Production returned:

```text
HTTP 403
{"error":"Forbidden"}
```

A subsequent database check returned:

```text
Doorkeeper::Application.where(name: "FingerprintBlockTest").count
=> 0
```

This confirmed that the matching OAuth application was rejected before a
Doorkeeper application record was created.

Production verification therefore established that:

1. the fingerprint matcher was loaded by the running application
2. the observed fingerprint was classified as blocked
3. `/api/v1/apps` returned HTTP 403
4. no OAuth application was persisted
5. the request could not proceed to application-level token acquisition

### Cleanup of post-mitigation OAuth application spray

After the fingerprint block was deployed and production verification completed,
the previously-created OAuth applications matching the observed fingerprint were
cleaned up.

A final pre-cleanup query selected applications using both the incident time/ID
range and the complete fingerprint:

```text
redirect_uri: urn:ietf:wg:oauth:2.0:oob
website: https://example.com
scopes: read write
confidential: true
```

The final selection returned:

```text
applications: 102
linked_users: 0
access_tokens: 95
access_grants: 0
first_id: 11220
last_id: 11325
```

The applications were removed through the Rails/Doorkeeper model using
`destroy_all` rather than direct SQL deletion.

The destruction path removed associated Doorkeeper access tokens and access
grants before deleting each application.

After cleanup, no matching fingerprint applications remained.

A wider token check across application IDs `11220..11325` returned two
remaining tokens, both belonging to unrelated `FediSuite` applications:

```text
11315  FediSuite
11316  FediSuite
```

Both applications used:

```text
website: https://fedi.adminforge.de
redirect_uri: https://fedi.adminforge.de/api/auth/fediverse/callback
scopes: read write push
```

These did not match the suspicious fingerprint and were intentionally preserved.

This verified that the 102 identified spray applications and their 95 associated
application-level tokens had been removed without deleting unrelated OAuth
clients in the same numeric ID range.

### Cleanup of separately reviewed suspicious registrations

During follow-up investigation, four additional suspicious local accounts were
reviewed separately from the 102-application fingerprint spray:

```text
scarletpoppy -> application 11328, Registration
htpfapvnn    -> application 11329, lightgraytime
mefdlt       -> application 11331, hyenastack
ByxavLel     -> application 11331, hyenastack
```

These registrations did not use the same OAuth fingerprint as the 102
applications above and are therefore not attributed to the same automated
workflow solely on that basis.

Before cleanup, all four accounts were confirmed and approved but had:

```text
statuses: 0
following: 0
followers: 0
```

Their `created_by_application_id` mappings were rechecked immediately before
deletion.

The accounts were then removed through Mastodon's normal account-deletion path:

```ruby
account.suspend!(origin: :local)

AccountDeletionWorker.perform_async(
  account.id,
  { "reserve_username" => false }
)
```

After Sidekiq completed the deletions, verification returned:

```text
remaining_target_users: 0
users_still_linked_to_apps: 0
target_apps: 3
```

The three OAuth applications were intentionally retained until account deletion
completed so that the application-to-user relationship remained available
throughout the user cleanup.

Immediately before OAuth application cleanup, the three applications had:

```text
apps: 3
tokens: 3
grants: 0
```

Applications `11328`, `11329`, and `11331` were then removed using
`Doorkeeper::Application#destroy` through `destroy_all`.

Final verification returned:

```text
remaining_apps: 0
remaining_tokens: 0
remaining_grants: 0
```

This completed cleanup of the separately reviewed account/application set while
leaving unrelated registrations and OAuth clients untouched.

# Monitoring Alert Issue

During the incident, Signup Review Bot messages were successfully delivered to the Matrix review room, but the administrator's iPhone did not generate push notifications for automated signup alerts.

Manual messages sent from the same Matrix bot account to the same room generated push notifications normally.

Inspection of the Signup Review Bot code showed that the main signup card was sent using:

```python
msgtype=MessageType.NOTICE
```

which is serialized as:

```text
m.notice
```

The main signup card was changed to:

```python
msgtype=MessageType.TEXT
```

while thread replies, enrichment details, and accept/reject confirmations remain `m.notice`.

After restarting the bot, signup alerts generated push notifications successfully on Element X for iPhone.

This issue did not cause the registration abuse itself, but it reduced the effectiveness of the moderation alerting path and contributed to delayed detection.

# Root Cause

The immediate cause was automated use of Mastodon's public OAuth application
registration and account-registration APIs.

During the initial activity, the automated client repeatedly:

1. registered new OAuth applications using the name `BoomProtocolProbe`
2. obtained client credentials for those applications
3. submitted account registrations through `/api/v1/accounts`
4. left the resulting accounts unconfirmed and pending

During later recurrences, the same general workflow continued while several
observable attributes changed:

- OAuth application names were randomized or made generic
- OAuth application creation and account registration used different apparent
  client IP addresses
- the User-Agent changed from a Python HTTP client to a browser-like string

The signup reason remained stable during the observed later recurrence:

```text
Automated protocol deliverability probe
```

The server permitted public OAuth application registration and account signup as expected by Mastodon.

The incident therefore did not demonstrate exploitation of a Mastodon vulnerability or unauthorized access to the server.

Two infrastructure and protocol characteristics made investigation and mitigation more difficult:

- Nginx initially did not restore the original client IP from Cloudflare
- IP addresses, OAuth application names, and User-Agent strings were not stable identifiers for the automated registration workflow

The identity, infrastructure, and precise purpose of the actor were not established.

After the signup-reason mitigation was deployed, automated-looking activity
continued registering OAuth applications under generic names.

A later group of 102 applications shared an identical OAuth application
fingerprint, and 95 of them obtained application-level access tokens within
seconds of creation. During the same observed period, repeated
`/api/v1/accounts` requests were rejected with HTTP 403 and no users were
created through those applications.

This demonstrated that application names alone were not a stable indicator and
that structural OAuth application attributes could provide an additional
incident-specific detection and blocking signal.

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

> An automated client repeatedly registered OAuth applications and used them to
> create pending Mastodon accounts. The initial activity used the application
> name `BoomProtocolProbe`; later activity used randomized or generic application
> names while retaining the same observed signup reason.

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
- Keep the main Signup Review Bot alert as `m.text` so moderator-facing signup events generate mobile push notifications.
- Keep the signup-reason blocklist enabled as an incident-specific mitigation
- Do not rely on signup reasons as permanent blocking indicators; they are
  client-controlled and can be changed
- Keep the observed OAuth application fingerprint block enabled while it
  remains relevant to SUP-0010
- Treat OAuth application fingerprints as incident-specific indicators rather
  than durable identities; clients can change redirect URIs, websites, scopes,
  or other application metadata

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
- Delivery of a Matrix event to a room does not guarantee that the event will generate a mobile push notification.
- Use `m.text` for moderator-facing alerts that require attention, while keeping passive thread/status messages as `m.notice` to avoid notification noise.
- Client-controlled registration fields such as OAuth application names,
  User-Agent strings, and signup reasons can all change and should be treated as
  temporary indicators rather than durable identities.

- Correlating OAuth application creation timestamps with access-token issuance
  and account-registration requests can reveal automated workflows even when
  application names and source IP addresses change.
- Repeated OAuth applications with identical redirect URI, website, scopes,
  and confidentiality settings can provide a stronger incident indicator than
  application name alone.
- Blocking a known abusive fingerprint earlier at `/api/v1/apps` prevents new
  matching OAuth application and access-token records from accumulating.
