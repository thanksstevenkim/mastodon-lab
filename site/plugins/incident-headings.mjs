// The original incident records use field-style H1 headings. The classic
// theme intentionally removes IDs from H1s, so its hash links cannot target
// those fields. Preserve the first source title and normalize the subsequent
// fields of the featured incident in the site AST only.
const featuredIncident = /(?:^|[\\/])incidents[\\/]014-nginx-restart-dns-failure-after-glibc-update-2026-11-13\.md$/;

export default function incidentHeadings() {
  return (tree, file) => {
    if (!featuredIncident.test(file.path || '')) return;
    let firstTitle = true;
    for (const node of tree.children || []) {
      if (node.type !== 'heading' || node.depth !== 1) continue;
      if (firstTitle) {
        firstTitle = false;
      } else {
        node.depth = 2;
      }
    }
  };
}
