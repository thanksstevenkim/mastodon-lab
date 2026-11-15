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
