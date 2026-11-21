# Karthik Krishna portfolio

Live website: https://gkkarthik224.github.io/

Static HTML, CSS and JavaScript, with local Framer runtime modules used by the homepage. Node.js 22.16+ and Python 3.10+ are sufficient; no npm packages or API keys are required.

## Build and preview

```powershell
npm run site:build
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. To preview source files through the original URL mappings instead, run `python -m server.app --port 8080`.

## Edit

- Canonical pages: `src/pages/`.
- Project cards, status, tools and certificates: `src/scripts/media/portfolio-cards.js`.
- Case-study content: `src/content/case-studies.json`; regenerate with `npm run content:build`.
- Shared navigation, theme and text effects: `src/scripts/` and `src/styles/`.
- Images and runtime modules: `public/`.
- Public URL mappings and supported legacy redirects: `config/routes.json`.

Register new public files in the URL manifest. Preserve runtime imports, script order and Framer layout classes. The referenced runtime bundles remain necessary even when a chunk is loaded only dynamically. Image attribution and license files are retained under `public/images/skills/`.

The contact and demo forms submit through FormSubmit to `gkrishnakarthik2004@gmail.com`. The owner must activate FormSubmit once using its confirmation email before notification delivery is enabled. Submission errors preserve the visitor's message for retry. No email API keys are included in the site. Employer and academic project details remain sanitized under NDA.

## Validate

```powershell
npm test
```

The standard-library test suite rebuilds the export, checks all public resources and runtime imports, follows legacy redirects with GitHub-style URL resolution, checks content-versioned assets, verifies certificate records and validates the local source server. These checks do not replace visual browser testing.

## Deploy

`.github/workflows/static.yml` runs the checks and publishes `dist` to GitHub Pages on pushes to `main`. The exporter versions assets by content to refresh changed files in cached browsers, and sends legacy page aliases to explicit directory URLs to prevent redirect loops.

The exporter adds Cloudflare Web Analytics to every content page. View visitor and page metrics in the Cloudflare dashboard under Web Analytics for `gkkarthik224.github.io`. The beacon site token is a public identifier embedded in the HTML; it is not an account API credential. Local source previews do not load the beacon.

## Code analytics

```powershell
npm run analytics
```

The report is saved to `reports/code-metrics.json`. It separates application code, development tools, generated case-study HTML and bundled runtime code. Counts are physical lines in tracked source files, excluding `.git`, dependencies, generated build output, local artifacts and the report itself. Minified files can contain a large amount of code on a single line, so the report also includes file sizes.
