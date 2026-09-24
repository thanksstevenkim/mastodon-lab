# OAuth Application Name Blocklist

## Purpose

This runbook documents the custom OAuth application-name blocklist used by the
Mustard Mastodon fork.

The feature was introduced after SUP-0010, where an automated client repeatedly
registered OAuth applications named `BoomProtocolProbe` and used them to create
pending accounts.

The initial Nginx per-IP and global registration rate limits remained useful
against high-rate bursts, but they could not completely prevent low-rate
automated registration attempts that stayed below the configured thresholds.

The application-name blocklist therefore provides an additional application-level
control for known, high-confidence abuse indicators.

It is not intended to be a general bot-detection or attribution mechanism.

## Configuration

Mustard loads Mastodon environment variables from:

```text
/opt/mastodon/.env.mastodon
```

Blocked OAuth application names are configured using:

```env
BLOCKED_OAUTH_APP_NAMES=ExampleBlockedClient
```

Multiple application names may be supplied as a comma-separated list:

```env
BLOCKED_OAUTH_APP_NAMES=ExampleBlockedClient,AnotherBlockedClient
```

Matching is:

- exact
- case-insensitive
- whitespace-trimmed

Substring matching is intentionally not used in order to reduce false positives.

## Enforcement

The blocklist is enforced at two separate stages.

### OAuth application registration

When a client sends:

```text
POST /api/v1/apps
```

the requested OAuth application name is checked before the Doorkeeper application
is created.

If the name is present in `BLOCKED_OAUTH_APP_NAMES`, the request is rejected.

This prevents a known abusive application name from creating additional OAuth
client credentials.

### Account registration

`AppSignUpService` also checks the name of the OAuth application used to create
an account.

This provides a second line of defense.

An OAuth application that was created before the blocklist was enabled cannot
continue creating new accounts once its name has been added to the blocklist.

The resulting control flow is approximately:

```text
POST /api/v1/apps
        │
        ▼
Check application name
        │
        ├── blocked ──► reject
        │
        └── allowed ──► create OAuth application


Existing OAuth application
        │
        ▼
Account registration
        │
        ▼
AppSignUpService
        │
        ▼
Check application name
        │
        ├── blocked ──► reject registration
        │
        └── allowed ──► continue signup
```

## Implementation

The blocklist is implemented in the custom Mastodon fork.

Relevant components include:

```text
app/lib/oauth_application_name_blocklist.rb
app/controllers/api/v1/apps_controller.rb
app/services/app_sign_up_service.rb
```

The implementation introduced for SUP-0010 was merged through:

```text
thanksstevenkim/mastodon-v2#4
Add OAuth application name blocklist
```

## Tests

The blocklist implementation was tested with:

```bash
RAILS_ENV=test DB_HOST=localhost DB_USER=mastodon_test DB_PASS='test-password' bundle exec rspec \
  spec/lib/o_auth_application_name_blocklist_spec.rb \
  spec/requests/api/v1/apps_spec.rb \
  spec/services/app_sign_up_service_spec.rb
```

Verified result:

```text
29 examples, 0 failures
```

The tests cover both major enforcement paths:

- blocking creation of a denied OAuth application
- blocking account registration through an existing denied application

Style verification was also performed:

```bash
bundle exec rubocop \
  app/lib/oauth_application_name_blocklist.rb \
  app/controllers/api/v1/apps_controller.rb \
  app/services/app_sign_up_service.rb \
  spec/lib/o_auth_application_name_blocklist_spec.rb \
  spec/requests/api/v1/apps_spec.rb \
  spec/services/app_sign_up_service_spec.rb
```

Verified result:

```text
6 files inspected, no offenses detected
```

## Production Deployment

Edit the Mastodon production environment file:

```text
/opt/mastodon/.env.mastodon
```

Add or update the variable using the current incident-specific values:

```env
BLOCKED_OAUTH_APP_NAMES=<private production values>
```

Do not copy active production IOC values into public documentation.

Then recreate the Mastodon containers:

```bash
cd /opt/mastodon
docker compose up -d
```

This causes the running containers to load the updated application code and
environment configuration.

After deployment, the blocklist becomes active for both:

1. new OAuth application registration
2. account registration through an existing blocked application

## Verification

After deployment, verify that the relevant Mastodon containers are running:

```bash
docker compose ps
```

The configured environment variable can also be checked from the application
container if necessary.

The expected production behavior for any configured blocked name is:

```text
New OAuth application using a blocked name
→ rejected

Existing OAuth application using a blocked name
→ account registration rejected
```

Normal OAuth application names should continue through the existing registration
flow.

### Production verification

After deployment, verify the mitigation at both the application and HTTP layers.

The production deployment was verified by confirming that:

- `BLOCKED_OAUTH_APP_NAMES` was present in the running `web` container
- the application-name matcher returned `true` for a configured test value
- an end-to-end `POST /api/v1/apps` request returned HTTP 403
- no OAuth application was created by the rejected request

The active production blocklist values are intentionally not reproduced in this
public runbook.

## Existing Data

Enabling the blocklist does not remove data that already exists.

It does not automatically delete:

- OAuth applications created before deployment
- pending accounts created through those applications
- access records associated with previous incident activity

Existing suspicious registrations must therefore be investigated and cleaned up
separately.

For SUP-0010, pending accounts associated with `BoomProtocolProbe` were removed
using Mastodon's account deletion workflow rather than direct PostgreSQL deletion.

The associated `BoomProtocolProbe` OAuth applications were also removed after the
affected accounts were cleaned up.

## Operational Use

Add a name to `BLOCKED_OAUTH_APP_NAMES` only when there is strong evidence that
the application identifier is associated with abusive registration activity.

Before adding a new value:

1. confirm the suspicious application name
2. correlate affected users using `created_by_application_id`
3. distinguish abusive registrations from unrelated legitimate pending users
4. preserve incident evidence when necessary
5. update `.env.mastodon`
6. run `docker compose up -d`
7. verify that normal registration behavior remains operational

When removing a name from the blocklist, use the same deployment procedure so the
updated environment is loaded by the containers.

## Defense in Depth

The application-name blocklist is only one layer of the registration-abuse
mitigation strategy.

The following controls should remain enabled where appropriate:

- Cloudflare client IP restoration in Nginx
- per-IP rate limiting on registration endpoints
- global registration rate limiting
- approval-based registration
- Signup Review Bot monitoring
- moderator review of pending accounts
- monitoring of unusual OAuth application creation

No single control should be treated as sufficient on its own.

## Limitations

OAuth application names are supplied by remote clients and are easy to change.

An automated client that changes its application name can bypass an exact-name
denylist until the new indicator is identified.

The blocklist therefore should not be treated as:

- proof of attacker identity
- a permanent anti-bot mechanism
- a replacement for rate limiting
- a replacement for registration review
- a substitute for incident investigation

User-Agent strings, IP addresses, application names, and similar indicators may
all change over time.

The purpose of the blocklist is to provide a precise operational control for a
known abusive pattern while minimizing disruption to legitimate OAuth clients.

## Related Incident

See:

[SUP-0010 — Automated registration abuse using BoomProtocolProbe](../incidents/010-automated-registration-abuse-boomprotocolprobe.md)
