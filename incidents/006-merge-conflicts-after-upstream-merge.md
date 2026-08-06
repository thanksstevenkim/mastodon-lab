# Ticket ID

SUP-0006

# Title

Merge conflicts after upstream merge

# Severity

Medium

# Environment

- Git
- Mastodon 4.5.11 to 4.6.2 upgrade
- Locally modified Mastodon source code

# Issue

`git merge --no-ff v4.6.2` produced merge conflicts.

# Symptoms

- Git could not complete the upstream merge automatically.
- Manual conflict resolution was required.

# Affected Files

- `backup_service.rb`
- `upload.tsx`
- `about/index.jsx`

# Impact

- Upgrade process was blocked.
- Local customizations could not be applied until conflicts were resolved.

# Investigation

1. Reviewed the files reported by Git as conflicted.
2. Compared local modifications with upstream changes.
3. Determined which customizations were still necessary.

# Root Cause

Local modifications conflicted with changes introduced upstream.

# Resolution

1. Accepted the upstream implementation.
2. Reapplied only the required Mustard-specific customizations.
3. Completed the merge after resolving all conflicts.

# Verification

- Merge completed without unresolved conflict markers.
- Local customizations were restored.
- Application build proceeded successfully.

# Lessons Learned

Avoid unnecessary local modifications to upstream files.

# Prevention

- Minimize direct modifications to upstream source files.
- Document required customizations separately.
- Review local changes before major upstream merges.
