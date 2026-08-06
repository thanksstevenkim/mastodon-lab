This repository is a collection of operational knowledge gained from maintaining a production Mastodon server, with an emphasis on troubleshooting, documentation, and continuous improvement.

# Mastodon Operations Lab

This repository documents my experience operating a self-hosted Mastodon server since 2022.

Rather than serving as a deployment guide, it focuses on real-world operational experience, including production incidents, troubleshooting, maintenance procedures, and version upgrades.

The goal of this repository is to demonstrate practical experience in:

- Linux server administration
- Docker-based application deployment
- Incident investigation and troubleshooting
- Technical documentation
- Service operations
- Infrastructure maintenance

## Repository Structure

[Incidents](incidents/)

Real production incidents, root causes, troubleshooting process, and postmortem documentation.

[Runbooks](runbooks/)

Operational procedures used for recurring maintenance tasks.

Examples:

- Backup
- Upgrade
- Docker
- Cloudflare
- Server setup

[Update Log](update-log/)

Version-specific upgrade notes and migration records.

[Operations](operations/)

Operational policies, moderation philosophy, governance decisions, and case studies based on real-world service management.

## Operational Experience

Production environment:

- Self-hosted Mastodon instance
- Public service operated since November 2022
- Peak Monthly Active Users: 165

Responsibilities included:

- Deploying new releases
- Managing Docker containers
- Troubleshooting production incidents
- Backup and recovery
- Server maintenance
- Moderation policy management
- Infrastructure documentation

## Server Spec

- 4c/8t CPU
- 32GB RAM
- 4TB HDD SATA

## Technologies

- Ubuntu Server
- Docker Compose
- PostgreSQL
- Redis
- Nginx
- Cloudflare
- Git

## Example Incident Reports

- [Cloudflare 521 after upgrade](incidents/001-cloudflare-521-after-upgrade.md)
- [Elasticsearch configuration issue](incidents/002-elasticsearch-service-name.md)
- [Docker image build failures](incidents/003-docker-image-push-failed-due-to-authentication-error.md)

## What This Repository Represents

Operating a production service involves more than deploying software.

This repository reflects practical experience in troubleshooting, documenting operational procedures, investigating incidents, and continuously improving service reliability.
