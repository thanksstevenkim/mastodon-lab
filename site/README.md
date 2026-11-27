# Mastodon Operations Lab — Docusaurus UI prototype

This folder is a **non-deployed prototype** for browsing existing Mastodon operations records. It does **not** replace the GitHub README or alter the production Mastodon server.

## Try locally

Prerequisite: Node.js 20+ and npm.

```bash
cd site
npm install
npm run start
# In a second terminal: npm run build
```

The expected GitHub Pages path, **if deployment is later approved**, is `https://thanksstevenkim.github.io/mastodon-lab/`. No publishing workflow is part of this prototype.

## Design

- Home: restrained engineering journal with a list of selected records, not handbook-style large navigation cards.
- Incidents: incident-themed layout; SUP-0014 has a short, explicitly non-exhaustive timeline.
- Runbooks: procedure-themed layout; the upgrade runbook has a *local-only* prerequisite checklist. Ticks are not saved and never authorize deployment.
- Update logs: release-log styling with section boundaries.
- Operations: quieter, long-form journal typography.

The site wraps the default Docusaurus `DocItem/Content` theme component. **Source Markdown files are not copied or moved**: Docusaurus reads `../incidents`, `../runbooks`, `../update-log`, and `../operations` directly. Existing GitHub file URLs remain intact.

The site supports EN/KO navigation. Its landing page and prototype UI panels have Korean copy; complete technical documents remain English until translated. The Korean view explicitly marks untranslated source documents.

## Boundaries

- This PR is an interface experiment, not a site launch.
- No GitHub Pages configuration or release deployment is modified.
- Original Markdown files remain authoritative; UI panels summarize only selected observed details.
- The build-only pull-request workflow performs no deployment.
- A later production launch should separately decide navigation labels, source document title metadata (incident files use `# Ticket ID`), redirects, translated content, and final GitHub Pages routing.

## Korean interface translations

- Keep the original English Markdown and all document IDs unchanged.
- The Korean navbar/footer and sidebar labels are stored in the standard Docusaurus JSON dictionaries under `i18n/ko/`. Sidebar document keys use the stable document ID, not the English title. The Korean labels are navigation titles, not claims of a translated document body.
- Docusaurus supplies its standard localized theme controls. Custom landing-page and prototype panel copy is maintained in the existing locale-aware React components.
- When adding a document, add its Korean navigation label in `docusaurus-plugin-content-docs/current.json` (use the sidebar name `updates` for `update-log/`). Until a label is supplied, the original title is used.
- Future translated Markdown goes in `i18n/ko/docusaurus-plugin-content-docs/current/` with the same relative path. Preserve commands, IDs, links, and the distinction between observations and hypotheses. No translated bodies are added by the interface phase.

## First translated records

The first four Korean bodies preserve source document IDs and section anchors. Fenced command/output blocks are copied verbatim from the corresponding English source. The source revision for this batch is `0c91976b4687af64ae4fdb0dc6087a1f5bea3f49`. The English source remains authoritative; review the corresponding translation when its source changes. The site identifies untranslated records separately.

Relative Markdown links between translated and fallback records are normalized to content-root references by `plugins/record-links.mjs` before Docusaurus resolves them. Its normal locale-aware resolution and strict broken-link check remain enabled; source Markdown and link targets are unchanged. The normalization test covers both source directories and preserves query/fragment suffixes.

The featured SUP-0014 incident retains its original Markdown field headings. During site compilation, `plugins/incident-headings.mjs` converts subsequent H1 fields to H2, so the classic theme generates section anchors and TOC entries in both locales. The first source title is unchanged.
