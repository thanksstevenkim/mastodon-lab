import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Docusaurus resolves content-root Markdown links across both locale roots,
// but relative links are resolved against the single source file's directory.
// Normalize only local record links before Docusaurus' own link resolver runs.
const root = fileURLToPath(new URL('../..', import.meta.url));
const koreanRoot = path.join(root, 'site/i18n/ko/docusaurus-plugin-content-docs/current');
const recordPath = /^(incidents|runbooks|operations|update-log)\/.+\.mdx?$/i;

export function normalizeRecordLink(url, sourcePath) {
  if (!sourcePath || !url || /^(?:[a-z][a-z\d+.-]*:|\/|@site\/|#|\?)/i.test(url)) return url;
  const match = url.match(/^([^?#]+\.mdx?)([?#].*)?$/i);
  if (!match) return url;
  const posix = (value) => value.split(path.sep).join('/');
  const local = posix(path.relative(koreanRoot, sourcePath));
  const relative = recordPath.test(local) ? local : posix(path.relative(root, sourcePath));
  if (!recordPath.test(relative)) return url;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1]));
  if (!recordPath.test(target)) return url;
  return '/' + target + (match[2] || '');
}

export default function recordLinks() {
  return (tree, file) => {
    function walk(node) {
      if (node.type === 'link' || node.type === 'definition') {
        node.url = normalizeRecordLink(node.url, file.path);
      }
      for (const child of node.children || []) walk(child);
    }
    walk(tree);
  };
}
