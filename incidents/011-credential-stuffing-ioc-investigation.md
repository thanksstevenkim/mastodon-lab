# Ticket ID

SUP-0011

# Title

Credential-stuffing IOC investigation following a Fediverse-wide account takeover alert

# Severity

Informational / Low

- Production service remained operational
- No confirmed account takeover was identified
- No known indicators of compromise were found in the inspected database records or available Nginx logs
- Investigation was performed proactively after an external Fediverse security alert

# Environment

- Mastodon 4.7.1
- Docker Compose
- PostgreSQL 14
- Nginx
- Cloudflare
- Redis
- Sidekiq
- Elasticsearch
- Custom Mastodon fork

# Issue

A Fediverse administrator alert reported a credential-stuffing campaign affecting multiple Mastodon instances.

The reported activity involved accounts being accessed with credentials apparently reused from unrelated data breaches rather than exploitation of a Mastodon vulnerability.

Reported indicators included:

- successful logins using the User-Agent `Go-http-client/1.1`
- several reported source IP addresses
- compromised accounts whose display names were changed to include `HACKED`
- newly created OAuth applications named `boost`

Because credential stuffing can affect fully patched instances when users reuse passwords across services, the production instance was inspected for the reported indicators.

# Impact

No production outage or confirmed account compromise was observed.

The investigation was precautionary and did not identify evidence that the reported campaign successfully compromised a local account.

# Investigation

## Login activity

PostgreSQL `login_activities` records were searched for successful authentication events using:

```text
Go-http-client/1.1
```

Result:

```text
0 rows
```

The reported source IP addresses were also searched directly in `login_activities`.

Result:

```text
0 rows
```

A broader query covering login activity since August 20, 2026 was then performed using both the reported IP indicators and User-Agent pattern.

Result:

```text
0 rows
```

## Successful-login review

All successful login records since August 20, 2026 were reviewed separately to avoid relying only on the published indicators.

A total of 29 successful login events were present in the inspected period.

Observed User-Agents were consistent with ordinary browsers and known Mastodon clients, including:

- Chrome
- Safari
- Firefox
- Samsung Internet
- Tusky

No successful login using `Go-http-client/1.1` was identified.

No login record in the reviewed set showed an obvious match to the reported automated credential-stuffing client.

## Account-name indicator

Local accounts were searched for display names containing:

```text
HACKED
```

Result:

```text
0 rows
```

## OAuth application indicator

OAuth applications were searched for names containing:

```text
boost
```

Result:

```text
0 rows
```

Recently created OAuth applications were also reviewed manually.

Several ordinary client applications were present, including known Mastodon clients.

One unrelated application named:

```text
lootbar-seo-poster
```

was investigated further because it did not resemble a normal interactive Mastodon client.

The application was linked to a newly created local account and had both an application token and a user token.

Timeline inspection showed that:

1. the OAuth application was created
2. an application token was issued
3. a new local account was created
4. a user-scoped OAuth token was issued

within approximately one second.

The account had:

```text
confirmed_at: NULL
sign_in_count: 0
statuses: 0
```

This pattern was consistent with automated use of Mastodon's account-registration API rather than takeover of an existing user account.

The registration was therefore treated as a separate automated-registration issue and not as evidence of the credential-stuffing campaign.

Personal account and email information observed during the investigation was not included in this repository.

## Nginx log review

Available Nginx logs were searched for the three source IP addresses included in the external alert.

No matching requests were found.

Nginx configuration was also inspected to confirm Cloudflare real-IP handling.

The server contained Cloudflare-specific trusted proxy ranges and:

```nginx
real_ip_header CF-Connecting-IP;
```

with `set_real_ip_from` restricted to Cloudflare proxy networks.

The application proxy configuration also forwarded:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Some historical Mastodon login records still contained Cloudflare addresses, so database IP fields were not treated as the sole source of evidence.

The investigation therefore combined database indicators, successful-login User-Agents, OAuth application records, account state, and available Nginx logs.

# Root Cause

No local security incident was confirmed, so no local root cause was established.

The external campaign was reported as credential stuffing: automated authentication attempts using username or email and password combinations obtained from unrelated credential leaks.

This attack class does not require exploitation of a Mastodon software vulnerability and primarily affects accounts whose passwords are reused across services.

# Resolution

No account-reset or emergency credential-revocation action was required because no local account matching the reported compromise indicators was identified.

No production configuration changes were made specifically in response to this investigation.

Existing Cloudflare real-IP restoration remained enabled.

The unrelated automated registration discovered during OAuth application review was handled separately from the credential-stuffing investigation.

# Verification

The following checks returned no matching compromise indicators:

```text
Successful Go-http-client/1.1 logins: 0
Reported source IPs in login_activities: 0
Local display names containing HACKED: 0
OAuth applications named boost: 0
Reported source IPs in available Nginx logs: 0
```

A separate review of all successful login events since August 20, 2026 did not identify an obvious automated credential-stuffing login.

Based on the available database records and retained Nginx logs, no indicators of compromise associated with the reported campaign were identified.

This result should not be interpreted as proof that no unauthorized authentication attempt ever occurred; it reflects the evidence available during the investigation.

# Lessons Learned

- Credential stuffing should be investigated separately from application vulnerabilities.
- A fully patched Mastodon instance can still be exposed to account takeover when users reuse passwords.
- Published indicators such as IP addresses and User-Agent strings are useful starting points but should not be treated as permanent attacker identities.
- Successful authentication records are more significant than failed login attempts when investigating credential stuffing.
- Reviewing all recent successful logins can identify anomalies that indicator-only searches may miss.
- OAuth application creation can reveal unrelated automated account-registration activity during a broader security investigation.
- Application tokens and user-scoped OAuth tokens should be distinguished when reviewing OAuth records.
- Unconfirmed API-created accounts should not automatically be interpreted as compromised existing accounts.
- Cloudflare proxy addresses in application-level records can complicate IP-based investigation.
- Database evidence and reverse-proxy logs should be correlated instead of relying on a single source.
- Security investigations should document both what was found and what was not confirmed.
- Personal information encountered during an investigation should be excluded from public operational documentation.

# Prevention

- Encourage users to use unique passwords for the Mastodon instance.
- Encourage users to enable two-factor authentication.
- Continue monitoring unusual successful login User-Agents.
- Continue monitoring unusual OAuth application creation.
- Preserve sufficient Nginx log history for future incident investigation.
- Keep Cloudflare real-IP restoration configuration current.
- Periodically verify trusted Cloudflare proxy ranges against Cloudflare's published ranges.
- Treat shared IP addresses and User-Agent strings as temporary indicators rather than permanent blocking rules.
- If a future account takeover is confirmed, reset the affected password and revoke active sessions and OAuth authorizations.
