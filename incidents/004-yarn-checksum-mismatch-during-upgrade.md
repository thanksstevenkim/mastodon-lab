# Ticket ID

SUP-0004

# Title

Yarn checksum mismatch during upgrade

# Severity

Medium

# Environment

- Mastodon 4.6.2 upgrade
- Yarn
- Docker image build environment

# Issue

`yarn install` failed during the Mastodon 4.6.2 upgrade.

# Symptoms

- `ajv` checksum mismatch
- Dependency installation could not continue

# Impact

- Docker image build blocked
- Upgrade process delayed

# Investigation

1. Reviewed the Yarn error output.
2. Identified the checksum mismatch related to the cached package.
3. Considered resetting the cached checksum before changing package versions.

# Root Cause

The cached package checksum became inconsistent with the expected checksum.

# Resolution

```bash
YARN_CHECKSUM_BEHAVIOR=reset yarn install
```

# Verification

- `yarn install` completed successfully.
- The Docker build process was able to continue.

# Lessons Learned

Cache corruption should be considered before changing package versions.

# Prevention

- Review Yarn checksum errors before modifying dependencies.
- Reset cached checksums when the package version itself has not changed.
