# Elasticsearch Pre-Nori Snapshot, R2 Archive, and Disaster Recovery Validation (2026-10-25)

## Summary and status

- **Date:** 2026-10-25 (JST)
- **Service:** Mustard, production self-hosted Mastodon search
- **Elasticsearch version:** 8.19.15
- **Change category:** Production search-index backup readiness and disaster-recovery validation
- **Backup result:** Six production search indexes captured in a successful filesystem snapshot, encrypted with GPG AES-256, and archived to Cloudflare R2
- **Recovery result:** The remotely stored archive was downloaded, verified, decrypted, and restored into an isolated Elasticsearch 8.19.15 cluster; all six indexes, 14 primary shards, and six search-API checks passed
- **Nori rollout status:** **Not deployed.** No production Nori plugin installation, index rebuild, Korean feature-flag activation, or application image rollout was performed

This record follows [Korean Nori search development and CI validation](korean-nori-search-development-and-ci-validation-2026-10-25.md). Its purpose was to establish a tested recovery point **before** changes to the production search analyzer and indexes. It is an operational evidence record, not a complete, automated backup runbook or a Nori production deployment report.

## Baseline and preparation

The initial production cluster was a healthy, single-node Elasticsearch 8.19.15 deployment with the existing search indexes. The production Elasticsearch container used a persistent data bind mount, but **no snapshot repository was registered** and `path.repo` was not configured. The Nori search feature flag was disabled.

The operator inspected the actual Docker Compose configuration, prepared a separate snapshot directory owned by the Elasticsearch process, and added:

- a distinct filesystem snapshot bind mount (separate from the live Elasticsearch data path);
- a matching `path.repo` setting via the existing Elasticsearch environment file.

Configuration validation verified that the original data mount, image version, and restart policy were preserved. Sensitive configuration files were backed up outside the public repository. Only the `es` Compose service was recreated to apply the static setting; the web, Sidekiq, PostgreSQL, and other services were not intentionally recreated for this change.

**Restart observation:** The cluster was briefly `red` with one unassigned shard while recovering after the Elasticsearch container recreation. A follow-up inspection confirmed `green`, one node, **21 active primary shards**, zero initializing/unassigned shards, and all six ordinary search indexes healthy. No forced allocation, index deletion, or data-directory reconstruction was used.

## Storage compatibility decision

Two different uses of Cloudflare R2 were evaluated and must not be conflated.

### Direct Elasticsearch S3 snapshot repository: rejected

The isolated Elasticsearch 8.19.15 S3-repository test used a separate R2 test bucket and scoped credentials. The built-in `repository-s3` module was available; the keystore loaded the test client credentials. Repository registration/verification succeeded. A small synthetic snapshot was created, restored under a new index name, and matched the original three documents and mapping.

**However, Repository Analysis failed with HTTP 500.** The diagnostic error was:

```text
repository_verification_exception
uncontended register operation failed:
expected [0] but did not observe any value
```

This is a failed storage-consistency/register-operation requirement, even though the small snapshot/restore worked. The exact underlying R2 API behavior was not isolated further. **Direct R2 registration as an Elasticsearch production snapshot repository was therefore not adopted.** A successful small snapshot alone is insufficient evidence of a suitable repository.

### Filesystem repository with R2 as an archive destination: selected

A separate Elasticsearch 8.19.15 filesystem-repository laboratory used an isolated container, an independently mounted snapshot directory, and no network connectivity. Results:

| Lab validation | Result |
| --- | --- |
| Filesystem repository registration and verification | Passed |
| Repository Analysis | Passed: 10 blobs, 10 write operations, 11 read operations, no issues detected |
| Synthetic snapshot and restore | Passed |
| Synthetic document and mapping comparison | Passed (3/3 documents) |
| Frozen repository copied to R2 and downloaded again | Passed |
| Lab repository file-path and SHA-256 comparison | Passed (9/9 files) |
| Separate, network-isolated Elasticsearch restore from the R2 copy | Passed (3/3 documents) |

For the R2 archive experiment, the source filesystem repository was made immutable for the duration of the copy by stopping the laboratory Elasticsearch container. This demonstrated the general recovery route without requiring Elasticsearch to use R2 as a live snapshot repository.

## First production filesystem snapshot

After the production node returned to `green`, the filesystem snapshot repository was registered and verified. The first creation attempt was rejected because the generated snapshot name contained uppercase timestamp characters (`T` and `Z`); a lowercase-only name corrected the request. The rejected request did not create a snapshot.

A subsequent request successfully captured **all six specified ordinary search indexes** with `include_global_state: false` and `partial: false`:

| Index | Restored snapshot Lucene docs | Primary shards |
| --- | ---: | ---: |
| `accounts` | 205,019 | 1 |
| `chewy_specifications` | 5 | 1 |
| `instances` | 15,722 | 1 |
| `public_statuses` | 1,865,150 | 5 |
| `statuses` | 455,115 | 5 |
| `tags` | 288,054 | 1 |
| **Total** | **2,829,065** | **14** |

Observed snapshot status progressed from `IN_PROGRESS` to **`SUCCESS`**, with **14/14 successful shards**, zero failed shards, and no active snapshot operations at final verification. The resulting local snapshot repository occupied approximately **1.4 GB** across **576 regular files**.

The document counts shown above are the later restored index's Lucene `docs.count` values, not a claim about the live cluster's counts at the time of documentation. The live indexes continued to accept writes during this work.

## Encrypted archive and off-site preservation

The operator temporarily changed the production filesystem snapshot repository registration to read-only while creating an independent archive of **the entire repository**, not a copy of Elasticsearch's live data directory.

The archive was produced as a TAR stream directly into **GPG symmetric AES-256 encryption**, avoiding a separately stored plaintext TAR. The first attempt failed because the graphical/pinentry passphrase agent timed out. The script's cleanup logic successfully returned the repository to a writable state. The workflow was revised to collect and test the passphrase in the terminal **before** switching the repository to read-only, using GPG loopback mode. The next archive attempt succeeded.

Successful archive checks:

- Approximate encrypted archive size: **1.4 GB**.
- Local SHA-256 manifest: verified.
- GPG decryption and full TAR listing: verified; **598 TAR entries** (including directory entries).
- Snapshot repository writable mode: **restored** after archive completion.

A **private, production-specific R2 bucket** and scoped API credentials were used to store the encrypted archive and its SHA-256 manifest, separately from the experiment bucket. The first rclone upload attempt reported S3 **`501 NotImplemented`** for both objects; a retry succeeded. A subsequent download-based rclone comparison reported **two matching files and zero differences**. The cause of the initial 501 responses was **not conclusively established** and remains an operational follow-up, not a reason to declare the first failed requests harmless in future jobs.

The encrypted archive and manifest were then downloaded from the production R2 archive location to a **separate recovery directory**. The downloaded manifest matched the original and the archive SHA-256 verification passed. After decryption and extraction, the reconstructed repository contained **576 files** and occupied approximately **1.4 GB**.

**Secret-handling boundary:** No passphrase, access key, secret key, private endpoint, bucket identifier, or complete live configuration is published here. The encryption passphrase must be retained in a secure location independent of the server and R2 credentials. The public record intentionally omits actionable live storage paths and remote object identifiers.

## Independent recovery validation using actual production search data

A new Elasticsearch **8.19.15** container was launched for the final production-backup recovery trial:

- Docker network mode `none`;
- no production Elasticsearch data or application network mount;
- the R2-reconstructed snapshot repository mounted at a **read-only filesystem path**;
- a separate writable data directory for the restored indexes;
- snapshot repository registered with `readonly: true`;
- Nori not required or installed for this legacy-index restoration.

The archived snapshot metadata was readable and reported the expected six indexes and 14 successfully backed-up primary shards. Each index was restored under a **`dr_`-prefixed name**. The isolated cluster then passed all final validation checks:

```text
=== Production Elasticsearch DR Final Validation ===
Recovery cluster isolation: VERIFIED
Cluster health: GREEN
Primary shards: PASSED (14/14)
Index document counts: PASSED (6/6)
Search: dr_accounts PASSED
Search: dr_chewy_specifications PASSED
Search: dr_instances PASSED
Search: dr_public_statuses PASSED
Search: dr_statuses PASSED
Search: dr_tags PASSED
Status index mappings: AVAILABLE
=== PRODUCTION DR FINAL VALIDATION PASSED ===
```

The search checks used `match_all` with no user documents printed. This validates shard availability and basic search functionality; it does **not** constitute a full semantic equivalence, complete mapping-by-mapping comparison, end-to-end application search test, or proof that future changes can be recovered without data loss.

The independent recovery container ran on **the same physical host**, not an off-site replacement server. The R2 remote archive was genuinely downloaded; the successful restore did not use the original local snapshot repository as its source.

## Post-validation DR lab cleanup (2026-10-25)

Following the successful independent restore validation, the operator retired the temporary production-data DR environment in controlled steps. Each command's output was reviewed before continuing:

- Confirmed the production Elasticsearch container remained healthy and used separate live-data and snapshot bind mounts.
- Inspected the isolated DR container: Elasticsearch 8.19.15, Docker network mode `none`, a dedicated writable restore-data bind mount, and a read-only bind mount of the R2-reconstructed snapshot repository. It was not a Docker Compose-managed service and had restart policy `no`.
- Compared mount references across all Docker containers; no other container referenced the three targeted temporary directories. Directory identity, non-symlink status, mount points, and open files were checked before cleanup.
- Stopped and removed **only** the final production-backup DR container. Then removed the restored index data directory, the decrypted/reconstructed filesystem snapshot repository, and the downloaded encrypted archive plus its SHA-256 manifest, verifying each target was absent afterward. Their previously observed directory sizes totalled approximately **4.2 GB** (three readings rounded to 1.4 GB).
- A shell command-substitution parsing error occurred during the first directory removal precheck. The intended DR directory was reported absent afterward; the production and protected backup directories were explicitly checked for continued existence. Subsequent deletions used fail-fast checks and exact paths.
- Left the original production Elasticsearch data directory, live filesystem snapshot repository, independently retained encrypted local archive, and production R2 archive **untouched** by cleanup commands. The remote R2 archive was not re-downloaded or independently rechecked during cleanup.
- Earlier, separate filesystem and R2 restore laboratory containers were **not** included in this cleanup and remain out of scope.

**Post-cleanup production checks (authenticated, read-only):**

| Check | Observed result |
| --- | --- |
| Cluster health | `green`, 1 data node, 21 active primary shards, 21 active shards, 0 unassigned shards, 0 pending tasks |
| Search index health | Six of six search indexes `green` |
| Search primary shards | 14 across the six indexes |
| Search Lucene document count | 2,829,250 across the six live indexes; expected to change with indexing |
| Snapshot repository registration | `mustard_fs_backup`, type `fs`, `readonly: false` |
| New write/restore performed during cleanup | None |

The final repository check confirms the configured writable **setting**, not a new successful write test. All observed post-cleanup checks passed, but they do not establish end-to-end Mastodon search behavior. No Nori installation, reindex, feature activation, or application deployment was performed.

## Scope, outstanding work, and safety limits

- **Backup scope:** Elasticsearch search indexes only. This snapshot used `include_global_state: false` and is **not** a complete Mastodon or PostgreSQL backup. Point-in-time search data and current live index counts can differ.
- **Retention and automation:** This was a manually executed, point-in-time recovery validation. Backup scheduling, versioned retention, error alerting, automated upload retries, and restore drills are not yet documented as production-ready.
- **Storage behavior:** Avoid direct Elasticsearch snapshot writes to R2 until the repository-analysis incompatibility is resolved and fully retested. Investigate the rclone `501 NotImplemented` first-attempt behavior before relying on unattended archival.
- **Confidentiality:** The temporary DR container, restored production-search data, and decrypted recovery repository were subsequently removed as documented above. Ordinary filesystem deletion is not a guarantee of physical media sanitization. The original production paths and backups were excluded.
- **Disaster scope:** Recovery was validated on one host using a separate network-isolated container. A true alternate-host recovery and an end-to-end Mastodon service recovery remain untested.
- **Nori deployment:** The source change was merged and passed CI, but the live Elasticsearch image, analyzers, and search mappings remain the pre-Nori configuration. The Korean search feature flag was not activated; no production reindex or cutover occurred.

## Next actions

1. Verify the production cluster and snapshot repository remain healthy/writable; retain the encrypted local and R2 backup copies plus the independent recovery passphrase.
2. **Completed (2026-10-25):** Retired the final production-data DR container and removed its recovered index data, decrypted repository, and downloaded encrypted archive. Other unrelated historical lab containers remain outside this cleanup scope.
3. Formalize a repeatable, monitored filesystem-snapshot → consistent encrypted repository archive → R2 upload workflow, including failure recovery, retention, and periodic independent restore tests.
4. Revisit the R2 S3 compatibility and rclone 501 behaviors separately; do not weaken verification merely to suppress a warning.
5. With a tested pre-Nori recovery point established, develop a **separate** staged Nori production rollout plan covering image/plugin, index mapping and reindex, concurrent writes, validation, and rollback.

## Lessons learned

- A successful repository registration and small snapshot/restore **do not replace** Repository Analysis for an S3-compatible snapshot backend.
- Treat live Elasticsearch data directories and Snapshot API repositories differently; copying live index files is not a supported snapshot strategy.
- Freeze repository writes while creating an independent copy, and always verify writable-mode recovery—even when encryption fails.
- Off-site upload success is stronger when followed by a real download, cryptographic integrity check, and isolated Elasticsearch restore.
- Distinguish a verified **search-index recovery point** from full-service disaster recovery, automated backup readiness, or a completed Nori production deployment.

This public operational record contains no credentials, raw production documents, passphrases, private network details, or operational backup object identifiers.
