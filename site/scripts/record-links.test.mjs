import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {normalizeRecordLink} from '../plugins/record-links.mjs';

const root = new URL('../../', import.meta.url);
const source = (name) => fileURLToPath(new URL(name, root));
const ko = 'site/i18n/ko/docusaurus-plugin-content-docs/current/';
const cases = [
  ['upgrade.md#rollback', 'runbooks/runtime-dependency-security-patches.md', '/runbooks/upgrade.md#rollback'],
  ['../incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md', 'operations/website-healthchecks-monitoring-2026-11-15.md', '/incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md'],
  ['../incidents/004-yarn-checksum-mismatch-during-upgrade.md', ko + 'runbooks/upgrade.md', '/incidents/004-yarn-checksum-mismatch-during-upgrade.md'],
  ['001-cloudflare-521-after-upgrade.md', ko + 'incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13.md', '/incidents/001-cloudflare-521-after-upgrade.md'],
  ['./backup.md?x=1#restore', 'runbooks/upgrade.md', '/runbooks/backup.md?x=1#restore'],
  ['https://example.org/file.md', 'runbooks/upgrade.md', 'https://example.org/file.md'],
  ['../README.md', 'runbooks/upgrade.md', '../README.md'],
  ['#rollback', ko + 'runbooks/upgrade.md', '#rollback'],
  ['../assets/image.png', 'runbooks/upgrade.md', '../assets/image.png'],
  ['/runbooks/upgrade.md', 'runbooks/backup.md', '/runbooks/upgrade.md'],
];
for (const [url, from, expected] of cases) assert.equal(normalizeRecordLink(url, source(from)), expected, from + ': ' + url);
console.log('Record link normalization:', cases.length, 'cases passed');
