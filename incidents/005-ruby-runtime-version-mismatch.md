# Ticket ID

SUP-0005

# Title

Ruby runtime version mismatch

# Severity

High

# Environment

- Mastodon 4.6.2
- Ruby
- Bundler
- rbenv
- Docker image build environment

# Issue

`bundle install` failed during the Mastodon 4.6.2 upgrade.

# Symptoms

```text
Bundler::RubyVersionMismatch
```

# Impact

- Ruby dependencies could not be installed.
- Docker image build could not continue.
- Upgrade process was delayed.

# Investigation

1. Reviewed the Bundler error message.
2. Checked the Ruby version required by Mastodon 4.6.2.
3. Compared it with the currently installed Ruby runtime.

# Root Cause

Mastodon 4.6.2 required Ruby 4.0.5, but the installed Ruby version did not meet the requirement.

# Resolution

1. Installed Ruby 4.0.5 using rbenv.
2. Reinstalled Bundler.
3. Ran `bundle install` again.

# Verification

- `bundle install` completed successfully.
- The Docker image build proceeded successfully.

# Lessons Learned

Runtime requirements should be reviewed before starting a major application upgrade.

# Prevention

- Check the required Ruby version in the target Mastodon release before upgrading.
- Install the required runtime before beginning the production deployment.
