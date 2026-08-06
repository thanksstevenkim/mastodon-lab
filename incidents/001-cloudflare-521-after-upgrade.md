# Ticket ID

SUP-0001

# Title

Cloudflare 521 after Mastodon upgrade

# Severity

High

# Environment

- Ubuntu 24.04 LTS
- Mastodon
- Docker Compose
- Nginx
- Cloudflare

# Issue

Users were unable to access the Mastodon instance after an upgrade.
Cloudflare returned HTTP 521 while application containers continued running normally.

# Symptoms

- Cloudflare HTTP 521
- Docker containers healthy
- PostgreSQL healthy
- Puma running normally
- Web access unavailable

# Impact

- Public web access unavailable
- Service downtime: approximately 60–90 minutes

# Investigation

1. Checked Docker Compose status (`docker compose ps`)
2. Verified Web and Puma logs
3. Confirmed PostgreSQL connectivity
4. Reviewed Elasticsearch logs
5. Tested nginx configuration using `nginx -t`
6. Checked nginx service status with `systemctl status nginx`

# Root Cause

Nginx failed to start due to an invalid configuration after the upgrade.
As a result, Cloudflare could not establish a connection with the origin server.

# Resolution

1. Verified nginx configuration using `nginx -t`
2. Removed duplicated nginx configuration
3. Restarted nginx
4. Confirmed successful service recovery

# Verification

- nginx running normally
- Cloudflare accessible
- Mastodon web interface available
- Users able to reconnect successfully

# Lessons Learned

- Cloudflare 521 does not always indicate an application failure.
- Reverse proxy services should be checked before investigating application containers.

# Prevention

- Run `nginx -t` before restarting nginx.
- Verify nginx service status whenever Cloudflare returns 521.
- Review upstream configuration after upgrades.
