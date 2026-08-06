# Spam and Moderation Runbook

## Purpose

This document describes the standard moderation procedures used to protect the Mastodon instance from spam, abusive accounts, and automated registrations.

---

## Detecting Suspicious Accounts

Review newly created accounts using the following indicators.

### Account Profile

- Recently created account
- Empty or AI-generated profile
- Repeated usernames
- Suspicious profile images

### Posting Behavior

- Repeated mentions to unrelated users
- Identical posts
- Discord invitation links
- Promotional content
- AI-generated repetitive posts

### Attachments

- Repeated image patterns
- Similar screenshots across multiple accounts

---

## Investigation Checklist

Before taking action:

- Review account profile
- Review recent posts
- Review mention targets
- Check account age
- Check instance reputation
- Review user reports

---

## Response

### Spam Account

- Suspend account
- Remove posts if necessary

### Compromised Instance

- Contact instance administrator (if possible)
- Close federation if abuse continues

### False Positive

- Restore account
- Record reason

---

## Registration Policy

Current policy:

- Open registration
- Manual review of suspicious accounts
- Immediate suspension of abusive accounts

Approval-based registration is intentionally not used because it delays legitimate users and requires continuous manual approval.

---

## Spam Detection Rules

Common indicators include:

- Newly created accounts
- Large numbers of mentions
- Repeated message patterns
- Attachment similarity

These indicators should be evaluated together rather than individually.

---

## Escalation

If multiple spam accounts originate from the same instance:

1. Review federation history.
2. Determine whether the instance appears abandoned.
3. Consider temporary or permanent defederation.

---

## Related Documents

- [Anti Spam Evolution](../operations/anti-spam-evolution.md)
- [Account Approval Policy](../operations/account-approval-policy.md)
- [Federation Governance](../operations/federation-governance.md)
- [Moderation Philosophy](../operations/moderation-philosophy.md)

## Guiding Principle

Moderation decisions should balance user safety, operational cost, and accessibility.

The goal is not to eliminate every spam account, but to minimize abuse while keeping the registration process convenient for legitimate users.
