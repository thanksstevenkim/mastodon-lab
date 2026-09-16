# OAuth Application Name Blocklist

## Purpose

This runbook documents the custom OAuth application-name blocklist used by the
Mustard Mastodon fork.

The feature was introduced after SUP-0010, where an automated client repeatedly
registered OAuth applications named `BoomProtocolProbe` and used them to create
pending accounts.

The blocklist is intended for known, high-confidence OAuth application indicators.
It is not a general bot-detection mechanism.

## Configuration

The blocklist is controlled through:

```env
BLOCKED_OAUTH_APP_NAMES=BoomProtocolProbe
```

Multiple names may be supplied as a comma-separated list:

```env
BLOCKED_OAUTH_APP_NAMES=BoomProtocolProbe,BadClient
```

Matching is:

- exact
- case-insensitive
- whitespace-trimmed

Substring matching is intentionally not used to reduce false positives.

## Enforcement

The blocklist is checked at two stages.

### OAuth application registration

`POST /api/v1/apps`

Blocked client names receive HTTP 403 before a Doorkeeper application is created.

### Account registration

`AppSignUpService` checks the name of the OAuth application used for signup.

This prevents an OAuth application created before the denylist was enabled from
being reused to create accounts.

## Tests

Relevant tests:

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

Style verification:

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

## Limitations

Application names are supplied by clients and are easy to change.

Therefore:

- keep registration rate limiting enabled
- continue monitoring OAuth application creation
- do not treat application-name matching as attribution
- add names only when there is strong incident-specific evidence
