# Mastodon Operations Lab

This repository collects operational knowledge gained from maintaining a production, self-hosted Mastodon server since November 2022. It focuses on real incidents, troubleshooting, recurring maintenance, and version upgrades rather than providing a general-purpose deployment guide.

The repository demonstrates practical experience in:

- Linux server administration
- Docker-based application deployment
- Incident investigation and troubleshooting
- Backup, recovery, and infrastructure maintenance
- Moderation policy and service operations
- Technical documentation and continuous improvement

## Repository Guide

| Area | Description |
| --- | --- |
| [Incidents](incidents/) | Production incidents, root-cause analysis, resolutions, and prevention measures |
| [Runbooks](runbooks/) | Repeatable operational procedures and troubleshooting guides |
| [Update logs](update-log/) | Version-specific upgrade records, validation results, and lessons learned |
| [Operations](operations/) | Moderation policies, governance decisions, and operational case studies |

Some runbooks are still being developed. Documents marked **Draft** are placeholders and should not be treated as production-ready procedures.

### Featured Documentation

- [Mastodon upgrade runbook](runbooks/upgrade.md)
- [Spam and moderation runbook](runbooks/spam-and-moderation.md)
- [Mastodon signup review bot](runbooks/mastodon-signup-review-bot.md)
- [Cloudflare 521 after an upgrade](incidents/001-cloudflare-521-after-upgrade.md)
- [Incomplete database migration](incidents/007-database-migration-incomplete-after-upgrade.md)
- [GitHub Actions failures caused by fork drift](incidents/009-github-actions-failures-from-fork-drift.md)

## Production Environment

- Self-hosted public Mastodon instance
- In operation since November 2022
- Peak monthly active users: 165
- 4-core/8-thread CPU, 32 GB RAM, and 4 TB SATA HDD

## Technology Stack

- Ubuntu Server
- Docker Compose
- PostgreSQL
- Redis
- Nginx
- Cloudflare
- Git

## Scope and Safety

The commands and configuration in this repository describe one production environment and may require adaptation elsewhere. Before using a runbook, review the applicable Mastodon release notes, replace example versions and paths, verify backups, and test the procedure in a non-production environment where possible.

Secrets, credentials, personal data, and environment-specific configuration values are intentionally excluded.

## What This Repository Represents

Operating a production service involves more than deploying software. This repository records the investigation, documentation, and process improvements used to make an independently operated service more reliable over time.
