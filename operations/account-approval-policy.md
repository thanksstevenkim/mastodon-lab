# Registration Policy Changes

## Background

The number of AI-generated accounts increased significantly as large language models became widespread.

Previously, open registration required frequent manual moderation.

## Considered Options

### Approval-based registration

Pros

- Prevents automated account creation.

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

The instance continued using open registration while actively reviewing newly created accounts and suspending abusive accounts.

## Rationale

Although moderation required additional effort, legitimate users could join immediately without waiting for manual approval.

## Lessons Learned

Registration policies should balance usability with moderation cost.

There is no perfect solution against automated account creation.
