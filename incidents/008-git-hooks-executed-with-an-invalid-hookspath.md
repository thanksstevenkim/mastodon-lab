# Ticket ID

SUP-0008

# Title

Pre-commit hook executed with an unexpected Ruby runtime after Git hooks misconfiguration

# Severity

Medium

- Development environment only
- Prevented commits but did not affect production

# Environment

- Ubuntu Server
- Git 2.43.0
- rbenv 1.3.2
- Ruby 4.0.5
- Bundler 4.0.13
- Yarn 4.16.0
- Husky 9
- lint-staged 17

# Issue

Git commits consistently failed during the pre-commit hook.

The error reported a Ruby version mismatch:

```
Your Ruby version is 3.2.3,
but your Gemfile specified >= 3.3.0
```

This was unexpected because the project had already been migrated to Ruby 4.0.5 through rbenv.

# Symptoms

- `git commit` always failed.
- `bundle exec rubocop` completed successfully.
- `bundle exec ruby` reported Ruby 4.0.5.
- `bin/rubocop` also worked correctly.
- Only the pre-commit hook reported Ruby 3.2.3.

# Impact

Unable to commit any changes.

Development was blocked until the hook configuration was corrected.

# Investigation

The Ruby environment was verified first.

Checked:

- `ruby -v`
- `bundle exec ruby -v`
- `which ruby`
- `which bundle`
- `bundle env`
- `rbenv versions`

Everything confirmed that Ruby 4.0.5 was correctly installed.

The next step was comparing execution contexts.

- Direct execution
- Bundler execution
- Yarn execution
- Husky pre-commit execution

Only the Git hook behaved differently.

While investigating Git configuration, the following value was found:

```
core.hooksPath=--version/_
```

This invalid path prevented Git from using the intended Husky hook directory.

# Root Cause

Git hooks were configured with an invalid `core.hooksPath`.

As a result, Husky was executed incorrectly, leading to misleading runtime behavior during `lint-staged`.

The reported Ruby version mismatch was therefore a symptom rather than the actual root cause.

# Resolution

Reset the Git hooks path:

```bash
git config core.hooksPath .husky/_
```

Confirmed that Husky executed correctly.
Once the hook configuration was fixed, the Ruby version mismatch disappeared.
The remaining failure was the actual TypeScript compilation error:

```
Property 'getIn' does not exist on type 'State'
```

which was unrelated to Ruby.

# Verification

Verified

- git commit now executes the Husky hook correctly.
- Ruby 4.0.5 is used inside the hook.
- Bundler no longer reports a Ruby version mismatch.
- Remaining failures originate from project source code instead of environment configuration.

# Lessons Learned

- Error messages can point to symptoms instead of the actual cause.
- Compare behavior across multiple execution contexts before assuming an environment problem.
- Validate Git configuration early when debugging pre-commit hooks.
- Once infrastructure issues are removed, the actual application errors become much easier to identify

# Prevention

- Verify core.hooksPath after cloning or migrating repositories.
- Keep Husky configuration under version control.
- Test both direct command execution and hook execution when modifying development tooling.
- Include Git hook configuration in project setup documentation.
