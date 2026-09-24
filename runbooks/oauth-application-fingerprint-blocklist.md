# OAuth Application Fingerprint Blocklist

## Purpose

This runbook documents the custom OAuth application-fingerprint block used by
the Mustard Mastodon fork.

The feature was introduced during SUP-0010 after automated registration activity
changed OAuth application names while continuing to create large numbers of
applications with the same underlying OAuth metadata.

Database inspection identified 102 applications sharing the same fingerprint:

```text
redirect_uri: urn:ietf:wg:oauth:2.0:oob
website: https://example.com
scopes: read write
confidential: true
```

Of those applications, 95 obtained application-level access tokens shortly after
creation.

The fingerprint block provides an additional incident-specific control for this
known pattern.

It is not intended to be a general bot-detection, attribution, or reputation
system.

## Observed Fingerprint

The currently blocked fingerprint is:

```text
redirect_uri: urn:ietf:wg:oauth:2.0:oob
website: https://example.com
scopes: read write
confidential: true
```

The block matches the complete combination rather than blocking any individual
field.

This is important because values such as an OOB redirect URI or common OAuth
scopes can also appear in legitimate applications.

## Enforcement

The fingerprint is enforced at two stages.

### OAuth application registration

When a client sends:

```text
POST /api/v1/apps
```

the application options are checked before the Doorkeeper application is
created.

If the full fingerprint matches the blocked pattern, the request is rejected
with HTTP 403.

This prevents creation of the matching OAuth application and therefore prevents
that request from proceeding to application-level credential acquisition.

### Account registration

`AppSignUpService` also checks the OAuth application object used for account
registration.

This provides a second line of defense for matching applications that already
exist in the database.

The resulting control flow is approximately:

```text
POST /api/v1/apps
        |
        v
Check application name
        |
        v
Check application fingerprint
        |
        +-- blocked --> HTTP 403
        |
        +-- allowed --> create OAuth application


Existing OAuth application
        |
        v
POST /api/v1/accounts
        |
        v
AppSignUpService
        |
        v
Check application name
        |
        v
Check application fingerprint
        |
        v
Check signup reason
        |
        +-- blocked --> reject registration
        |
        +-- allowed --> continue signup
```

## Normalization

The matcher normalizes values before comparison.

For redirect URIs and scopes it:

- accepts string or array-like input
- splits whitespace-separated values
- removes empty values
- removes duplicate values
- sorts values before comparison

For the website value it:

- trims whitespace
- compares case-insensitively by lowercasing the value
- removes trailing slashes

This prevents trivial representation changes such as:

```text
read write
write read
write read read

https://example.com
https://example.com/
```

from bypassing the observed fingerprint match.

The matcher does not attempt broad URL canonicalization or behavioral
classification.

## Implementation

The block is implemented in the custom Mastodon fork.

Relevant components include:

```text
app/lib/oauth_application_fingerprint_blocklist.rb
app/controllers/api/v1/apps_controller.rb
app/services/app_sign_up_service.rb
```

The implementation was merged through:

```text
thanksstevenkim/mastodon-v2#5
Block known automated OAuth registration fingerprint
```

The merge commit was:

```text
021d9f1e192f74b701db74b0aee3db28136ede5b
```

## Tests

The implementation includes coverage for:

- the observed blocked fingerprint
- scope ordering and duplicate scope normalization
- trailing website slash normalization
- different websites
- different scopes
- different redirect URIs
- non-confidential applications
- HTTP 403 from `POST /api/v1/apps` without persisting an application
- account-registration rejection through an already-existing matching application

The pull request passed CI before merge.

## Production Deployment

The feature is part of the Mastodon application code and does not require a
separate environment variable for the current fingerprint.

After updating the production checkout, recreate or restart the Mastodon
containers using the normal deployment procedure so that the running
application loads the new code.

For the current Docker Compose deployment:

```bash
cd /opt/mastodon
docker compose up -d
```

## Verification

### Matcher verification

The production matcher can be checked from the running `web` container:

```bash
docker compose exec web bin/rails runner \
  'puts OAuthApplicationFingerprintBlocklist.blocked?(
    redirect_uris: "urn:ietf:wg:oauth:2.0:oob",
    website: "https://example.com",
    scopes: "read write",
    confidential: true
  )'
```

Expected result:

```text
true
```

### End-to-end verification

A matching test request can be sent to `POST /api/v1/apps`:

```bash
curl -i -X POST https://mustard.blog/api/v1/apps \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name": "FingerprintBlockTest",
    "redirect_uris": "urn:ietf:wg:oauth:2.0:oob",
    "scopes": "read write",
    "website": "https://example.com"
  }'
```

Expected result:

```text
HTTP 403
{"error":"Forbidden"}
```

Then confirm that the application was not persisted:

```bash
docker compose exec web bin/rails runner \
  'puts Doorkeeper::Application.where(name: "FingerprintBlockTest").count'
```

Expected result:

```text
0
```

This exact production verification was completed successfully after deployment.

## Existing Data

Deploying the fingerprint block does not delete applications or access tokens
that were created before the code was deployed.

Existing incident data must therefore be investigated and cleaned up separately.

Cleanup should be scoped using the complete fingerprint and the relevant
incident time range rather than generic application names such as `Mastodon`
or `Web`, because those names can also be used by unrelated clients.

Preserve evidence and verify the selection before destructive cleanup.

For SUP-0010, production cleanup followed this sequence after evidence
preservation and mitigation deployment:

1. re-query the exact fingerprint and confirm the expected application count
2. confirm that no users are linked to the selected applications
3. record associated access-token and access-grant counts
4. remove the selected applications with `destroy_all`
5. verify that unrelated applications in the same numeric ID range remain intact

The final pre-cleanup selection contained:

```text
102 OAuth applications
0 linked users
95 access tokens
0 access grants
```

After deletion, two tokens still present within the broader application ID
range were traced to unrelated `FediSuite` applications and were preserved.

A separate set of four suspicious accounts linked to three different OAuth
applications was cleaned up independently. Those user accounts were removed
through Mastodon's suspension and `AccountDeletionWorker` path first. Only
after the users were gone were the three OAuth applications and their associated
tokens removed.

This ordering preserves application-to-user evidence until account cleanup is
complete and reduces the risk of deleting unrelated OAuth clients.

## Relationship to Other Controls

The fingerprint block is one layer in the registration-abuse mitigation stack.

Other controls currently used include:

- OAuth application-name blocking
- signup-reason blocking
- per-IP registration rate limiting
- global registration rate limiting
- Cloudflare client IP restoration
- approval-based registration
- Signup Review Bot monitoring
- moderator review

The application-name and signup-reason controls remain useful even though those
fields are client-controlled.

The fingerprint block moves one step earlier in the workflow by rejecting a
known matching application at `/api/v1/apps`.

## Limitations

The current fingerprint is an incident-specific indicator.

A remote client can change:

- redirect URI
- website
- scopes
- application confidentiality behavior
- application name
- signup reason
- User-Agent
- source IP address

Changing one or more fingerprint fields can produce a different application
fingerprint that will not match this exact control.

The block therefore should not be treated as:

- a permanent anti-bot mechanism
- proof that two requests came from the same actor
- proof of attacker identity or infrastructure
- a replacement for registration monitoring
- a replacement for incident investigation

The goal is to reject a high-confidence known pattern with minimal impact on
unrelated OAuth clients.

## Related Documentation

- [SUP-0010 — Automated registration abuse using BoomProtocolProbe](../incidents/010-automated-registration-abuse-boomprotocolprobe.md)
- [OAuth application name blocklist](oauth-application-name-blocklist.md)
