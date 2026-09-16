# Registration Policy Changes

## Background

The number of AI-generated accounts increased significantly as large language models became widespread.

Previously, open registration required frequent manual moderation.

## Considered Options

### Approval-based registration

Pros

- Prevents automated registrations from becoming active without moderator review.

Cons

- Delays legitimate users.
- Requires continuous administrator attention.

### Open registration

Pros

- Immediate user onboarding.

Cons

- Higher moderation workload.

## Previous Policy

Mustard previously used open registration.

The main reason was to avoid delaying legitimate users and requiring continuous
administrator attention.

## Current Policy

The instance later moved to approval-based registration together with the
Mastodon Signup Review Bot.

New registrations remain pending until they are reviewed.

The bot forwards confirmed registrations to a private Matrix moderation room,
allowing approval or rejection without continuously monitoring the Mastodon
administration interface.

## Why the Policy Changed

Operational conditions changed over time.

Increasing automated registrations and the availability of a dedicated review
workflow reduced the usability advantage of unrestricted registration while
making approval-based registration operationally practical.

## Final Decision

Mustard currently uses approval-based registration.

New registrations remain pending until they are reviewed through the Mastodon
administration workflow and Signup Review Bot.

## Rationale

Approval-based registration adds some friction for legitimate users, but the
Signup Review Bot reduces the operational cost by forwarding confirmed
registrations to a private Matrix room for review.

This provides a practical balance between preventing automated registrations
from becoming active accounts and keeping the review workload manageable.

## Lessons Learned

Registration policies should balance usability with moderation cost.

There is no perfect solution against automated account creation.
