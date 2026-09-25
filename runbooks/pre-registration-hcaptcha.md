# Pre-registration hCaptcha for Web Signup

## Purpose

This runbook documents the Mustard-specific change that requires hCaptcha
before a browser registration creates a local Mastodon user.

The change was introduced during SUP-0010 after an automated client received
HTTP 403 from the direct API signup path and then immediately completed the
normal browser registration workflow.

The goal is to keep public web signup available while preventing failed CAPTCHA
attempts from accumulating pending user records.

## Background

Mastodon already includes hCaptcha support through:

```text
Auth::CaptchaConcern
```

Before this change, the challenge was used during email confirmation.

That ordering means:

```text
browser signup
    |
    v
local user created
    |
    v
confirmation email
    |
    v
hCaptcha
```

For registration abuse, this is too late to prevent the local user record from
being created.

The Mustard fork changes the browser flow to:

```text
browser signup form
    |
    v
hCaptcha
    |
    +-- failed --> render signup form, no user persisted
    |
    +-- passed --> normal Devise account creation
                         |
                         v
                   email confirmation
```

## Implementation

The implementation is maintained in the custom Mastodon fork and was introduced
through:

```text
thanksstevenkim/mastodon-v2#6
Require hCaptcha before web account creation
```

Relevant components include:

```text
app/controllers/auth/registrations_controller.rb
app/controllers/auth/confirmations_controller.rb
app/controllers/concerns/auth/captcha_concern.rb
app/views/auth/registrations/new.html.haml
```

The registration controller now includes `Auth::CaptchaConcern`, extends the
content-security policy for the challenge, and verifies hCaptcha before the
normal Devise create path proceeds.

The signup view renders the existing CAPTCHA widget.

Web-created users are not challenged a second time during email confirmation.
The existing confirmation-stage behavior remains available for app-created
registrations.

## Configuration

The existing Mastodon hCaptcha configuration is reused.

Required configuration includes:

```text
HCAPTCHA_SITE_KEY
HCAPTCHA_SECRET_KEY
Setting.captcha_enabled
```

Secret and site-key values are not stored in this public repository.

If hCaptcha is disabled or the required configuration is unavailable, the
existing helper reports that CAPTCHA is not required and normal registration
behavior continues.

## Deployment

After merging the application change, rebuild the Mastodon image and recreate
the application containers using the normal production deployment procedure.

For the current Docker Compose deployment, the general sequence is:

```bash
cd /opt/mastodon
git checkout main
git pull --ff-only origin main
docker compose build
docker compose up -d
docker compose ps
```

No database migration was required for this change.

## Verification

Do not print hCaptcha secret values during production verification.

Verify only whether the configuration is present and enabled.

Expected checks include:

```text
site key present: true
secret key present: true
captcha enabled: true
```

Then test the browser signup flow directly.

Verify that:

1. the signup form displays hCaptcha before account creation
2. a failed or incomplete CAPTCHA does not create a user
3. a successful CAPTCHA allows the normal signup flow to continue
4. the registration can proceed to approval-based pending state
5. email confirmation does not require the same web registrant to solve a
   duplicate CAPTCHA

Also keep the direct API signup control independently verified if web-only signup
is the intended production policy.

## Relationship to API Signup Blocking

Pre-registration hCaptcha and API signup blocking solve different parts of the
same abuse path.

The production defense is intentionally layered:

```text
direct API account signup
        |
        +-- blocked

browser signup
        |
        v
pre-registration hCaptcha
        |
        v
approval-based registration
        |
        v
moderator review
```

OAuth application registration remains available because legitimate third-party
clients may rely on dynamic client registration.

## Limitations

hCaptcha raises the cost of automated browser registration but should not be
treated as proof that every challenged signup is human.

A determined client may use browser automation, external CAPTCHA-solving
services, or manual assistance.

If suspicious confirmed registrations continue after deployment, investigate
the new workflow before adding more blocking rules.

Avoid relying on:

- User-Agent strings
- source IP alone
- application names alone
- arbitrary signup-reason text
- longer fixed form-delay thresholds

These indicators can be useful during investigation but are easy for a client to
change.

## Related Documentation

- [SUP-0010 — Automated registration abuse using BoomProtocolProbe](../incidents/010-automated-registration-abuse-boomprotocolprobe.md)
- [OAuth application name blocklist](oauth-application-name-blocklist.md)
- [OAuth application fingerprint blocklist](oauth-application-fingerprint-blocklist.md)
