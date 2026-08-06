# Ticket ID

SUP-0007

# Title

Database migration incomplete after upgrade

# Severity

High

# Environment

- Mastodon 4.6.2
- Ruby on Rails
- PostgreSQL
- Docker Compose

# Issue

Application containers encountered schema-related errors after deployment.

# Symptoms

- `avatar_description` column missing
- `keypairs` table missing
- `require_2fa?` undefined method

# Impact

- Application containers encountered startup and runtime errors.
- Production deployment could not be considered complete.
- Upgrade process was delayed.

# Investigation

1. Reviewed application error messages.
2. Identified multiple missing schema objects.
3. Checked the current database migration status.

# Root Cause

Required database migrations had not been executed after upgrading the application.

# Resolution

```bash
bundle exec rails db:migrate
```

# Verification

```bash
bundle exec rails db:migrate:status
```

- Confirmed that all required migrations were applied.
- Application containers started successfully.

# Lessons Learned

Database migration is part of deployment, not a post-deployment task.

# Prevention

- Include database migration in the standard upgrade procedure.
- Check migration status before starting production containers.
- Verify schema changes before declaring an upgrade complete.
