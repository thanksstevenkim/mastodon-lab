# Ticket ID

SUP-0009

# Title

GitHub Actions failures caused by accumulated fork drift

# Severity

Low / Medium

- Production service remained operational
- CI validation was unreliable
- Security dependency audit initially failed

# Environment

- Mastodon 4.6.6
- Ruby 4.0.5
- Rails 8.1.3 → 8.1.3.1
- Yarn 4.16.0
- GitHub Actions
- Custom Mastodon fork

# Issue

Multiple GitHub Actions jobs were failing despite the Mastodon 4.6.6 upgrade completing successfully.

Failures included:

- bundler-audit vulnerabilities
- CSP RSpec failure
- Tag.search_for(nil) RSpec failure
- JavaScript lint errors
- streaming workspace ESLint command failure

# Impact

Production was not affected.

However:

- CI remained red
- dependency vulnerabilities were detected
- fork differences made future upgrades harder to validate

# Investigation

## Dependency security findings

`bundler-audit` detected:

- ActiveStorage 8.1.3 / CVE-2026-66066
- mail 2.9.0 / GHSA-mvxr-6m87-mv2q

Rather than modifying dependency versions manually, upstream commits were located and backported.

Rails was updated from 8.1.3 to 8.1.3.1 and mail from 2.9.0 to 2.9.1.

Verification:

```text
No vulnerabilities found
```

## RSpec failures

Two tests consistently failed:

- Content-Security-Policy sets the expected CSP headers
- Tag.search_for handles nil query

The fork was compared against upstream v4.6.6.

CSP failure:
A previous theme customization had replaced:

```ruby
javascript_inline_tag 'theme-selection.js'
theme_color_tags color_scheme
```

with a hard-coded theme-color meta tag.

This prevented the expected inline script hash from being added to CSP.

Tag failure:
HashtagNormalizer had been modified to return nil for an empty normalized value.

This caused:

```ruby
sanitize_sql_like(nil)
```

and raised a NoMethodError.

Both components were restored to upstream 4.6.6 behavior.

## JavaScript lint failures

GitHub Actions reported approximately 30 JSX lint errors and:

command not found: eslint

Initially, the individual JSX files appeared to be problematic.

To separate upstream behavior from fork-specific behavior, a clean worktree was created:

```bash
git worktree add /tmp/mastodon-v466 v4.6.6
```

Running:

```bash
yarn lint:js --max-warnings 0
```

against the clean upstream tag returned exit code 0.

This confirmed that the problem was specific to the fork.

Two differences were identified:

1. eslint.config.mjs contained:

```JavaScript
{
files: ['**/*.jsx'],
},
```

This unintentionally added JSX files to the lint target set.

2. streaming/package.json contained an extra lint:js script.

The streaming workspace did not provide its own ESLint executable, causing exit code 127.

Both files were restored to upstream v4.6.6 behavior.

Verification:

```bash
yarn lint:js --max-warnings 0
echo $?
```

Result: exit code `0`

# Lessons Learned

- A successful application upgrade does not guarantee that a long-lived fork is internally consistent.
- Compare failing code against the exact upstream release before modifying application logic.
- Use a clean git worktree to distinguish upstream failures from fork-specific failures.
- Prefer backporting known upstream security fixes over creating local dependency patches.
- CI failures may reveal stale customizations that are no longer used.
- Fix the cause of failing tests rather than changing tests to match broken behavior.
- Keep local customization surface as small as possible to reduce future merge drift.
