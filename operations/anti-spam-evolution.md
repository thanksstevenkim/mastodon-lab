# Anti-Spam Strategy Evolution

## Background

A coordinated spam campaign originated from abandoned Mastodon instances with open registrations.

The attackers repeatedly mentioned random users while promoting Discord invitation links.

## Impact

- Large numbers of unsolicited mentions
- User reports
- Increased moderation workload

## Root Cause

Compromised or abandoned instances remained federated while allowing unrestricted account creation.

## Mitigation

### Instance-level

- Contacted instance administrators whenever possible.
- Requested registration closure.
- Defederated abandoned instances when necessary.

### Spam Detection

The spam filter was gradually improved by detecting:

- Newly created accounts
- Number of mentioned users
- Image attachment patterns
- Repeated message patterns

## Lessons Learned

Open registration alone was not the primary issue.

Abandoned federated servers posed a much greater security risk than active communities.

Spam filtering should combine multiple signals instead of relying on a single heuristic.
