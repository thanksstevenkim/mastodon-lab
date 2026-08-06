# Ticket ID

SUP-0002

# Title

Elasticsearch service name mismatch after upgrade

# Severity

High

# Environment

- Ubuntu 24.04 LTS
- Mastodon
- Docker Compose
- Elasticsearch
- Sidekiq

# Issue

Sidekiq failed to connect to Elasticsearch after upgrading Mastodon.

# Symptoms

- Temporary failure in name resolution
- Sidekiq unable to connect to Elasticsearch
- Search functionality unavailable

# Impact

- Web UI affected
- API unavailable
- Federation temporarily interrupted
- Downtime: approximately 60–90 minutes

# Investigation

1. Checked running Docker containers
2. Confirmed console container status
3. Compared docker-compose.yml with the latest release
4. Reviewed Elasticsearch configuration
5. Compared ES_HOST with container names

# Root Cause

The Elasticsearch container name had changed during the upgrade, but ES_HOST still referenced the previous service name.

# Resolution

1. Backed up existing docker-compose.yml
2. Applied the latest compose configuration
3. Updated ES_HOST from `elasticsearch` to `es`
4. Recreated containers
5. Verified Sidekiq connection to Elasticsearch

# Verification

- Elasticsearch reachable
- Sidekiq connected successfully
- Search functionality restored
- Federation resumed

# Lessons Learned

- Configuration changes between releases should always be reviewed.
- Service names referenced in environment variables must match Docker Compose services.

# Prevention

- Compare compose files before upgrades.
- Back up configuration files before modification.
- Validate service names after major upgrades.
