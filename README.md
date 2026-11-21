# Portfolio development

Local portfolio with personal content stored directly in the pages and a local Framer runtime.
Python 3.10+ is sufficient to serve it; no package installation or build is required.

## Run

From this directory:

```powershell
python -m server.app --port 8080
```

Open http://localhost:8080 rather than opening `src/pages/**/index.html` directly.
The server resolves public asset URLs to their source folders; `file://` cannot resolve those mappings.
Canonical HTML files redirect direct file openings to the matching page on port 8080; keep the server running.
The default host is `0.0.0.0`, preserving LAN access.
Use `--host 127.0.0.1` when you only want access from this computer.
The existing `E:\Portfolio\serve_portfolio.py` launcher delegates to this server.
Run one server per port. The background instance currently uses port 8080.

## Layout

```text
src/
  pages/
    home/index.html
    about/index.html
    portfolio/index.html
    contact/index.html
    skills/index.html
    projects/travel-easy/index.html
  scripts/
    identity/       # Shared name, contact details, project titles and location logic
    theme/          # Theme state, persistence, toggle handlers and synchronization
    navigation/     # Page transitions and Skills navigation
    cursor/         # Pointer interaction
    skills/         # Skills-specific entry point
  styles/
    shared/         # Site-wide customizations
    pages/skills/   # Skills styling and entrance animation
public/
  images/
    portrait/
    projects/
  runtime/          # Local Framer modules with personal content and project records
config/routes.json  # Public page routes and legacy asset aliases
server/
  app.py            # CLI, application factory and lifecycle
  routing.py        # URL-to-file resolver and manifest validation
  handlers.py       # Shared HTTP handler and cache policy
tests/
  fixtures/         # Response hashes captured before restructuring
  test_http_contract.py
  browser-smoke.mjs
archive/
  research/        # Retained portrait preparation notes
artifacts/         # Ignored verification output
```

## Editing conventions

- Edit the canonical page in `src/pages/`. Use the shared feature scripts for behavior used by multiple pages.
- Public URLs are intentionally independent of filesystem paths. Register new files and routes in `config/routes.json`; links use public URLs, not `src/` paths.
- Keep existing script execution order, query versions, `defer` flags, Framer class names and animation markup when making structural edits.
- Active HTML and `public/runtime/` contain the current personal content. The runtime uses local project records, not the template author's CMS. Keep both consistent when editing content.
- Keep theme persistence in `theme/theme-sync.js`, navigation in `navigation/`, and text sizing in `identity/personal-layout.js`.
- Home uses its navigation cards and a visible engineering specialization. Inner pages use the shared floating page menu; the retired context bar remains hidden.
- Add new image files to `public/images/projects/` and map their public paths in the manifest. Runtime images use root-relative public URLs.
- Superseded archived pages and screenshots were removed. Legacy HTML URLs redirect to their current canonical pages; old screenshot URLs return 404. Archived research copies containing retired template references were also removed.

## Editing portfolio cards

Edit the `projects` array in `src/scripts/media/portfolio-cards.js` to update each
card's title, organization, category, summary, description and focus tags.
The listing uses text-only project rows with titles and summaries on the left
and technical details on the right. Below 900px, these columns stack. Project
artwork is not rendered. The page introduction lives in the same script.
FRP and UAV include a native Certificate disclosure. Set `certificate.image`
to a certificate image filename under `public/images/projects/` (and register
its URL in `config/routes.json`), or a direct image URL. While unset, opening
the disclosure says the certificate has not been added. Certificates retain
their original aspect ratio.
Optional `role`, `tools` (an array of names), `year`, `demoUrl` and `sourceUrl`
fields appear when supplied. `caseStudyUrl` links to an existing project page.
Leave links unset until their destinations are available. Card styles are in
`src/styles/pages/portfolio/portfolio-cards.css`.

## Validation

Reusable Playwright scenarios and an optional AI-assisted portfolio audit are
available in [automation/README.md](automation/README.md). Run `npm ci`,
`npm run browsers:install`, then `npm run qa:all`. This starts its own preview
on port 8765 and saves reports, screenshots and a reusable content-interview
prompt under `artifacts/qa/`. `npm run qa:ai` additionally runs a configured
OpenAI review; the local test/audit commands require no API key.

Shared loading, navigation, scroll reveals, history restoration and reduced-motion behavior can be checked without launching a browser:

```powershell
node tests/page-motion-check.mjs
```

All canonical pages use `src/scripts/navigation/page-transitions.js` and `src/styles/shared/page-motion.css`. The shared controller owns the original Lenis scroll implementation in `smooth-scroll.js`; the imported Framer scroll component yields to it. Keep one scroll controller per page. The loader waits for first-screen assets with a timeout, and the decorative fixed blur stack is hidden to prevent horizontal bands over content.

```powershell
python -m unittest discover -s tests -v
```

These checks start a temporary local server and compare the retained page/asset responses, content types, nested asset paths, version queries and existing missing routes.
The fixture deliberately locks the current content. For an intentional future UI/content change, review and update only the corresponding expected hashes after checking the rendered result.

With the site running on port 8080, Node.js 22+ and Google Chrome installed:

```powershell
node tests/browser-smoke.mjs
node tests/about-layout-check.mjs
```

This records the eight available pages at 320, 360, 390 and 430px mobile widths, plus desktop, checking horizontal page overflow and selected-menu visibility. Output goes to `artifacts/browser-smoke/`. Override `CHROME_PATH` if Chrome is installed elsewhere. External Framer resources require an internet connection.

## Preservation boundary

Framer layout and animation code remains in place. Personal identity, portrait, location, metadata and project records have replaced template data in the active source. Original testimonials, employment history and contact details were removed rather than attributed to the portfolio owner. The template form destination was removed. The contact form now validates input and prepares a local email draft, which the visitor reviews and sends from their own email app. No message is automatically submitted to a server.

About renders directly from its canonical HTML and `src/styles/pages/about/about.css`, using the shared menu, theme and motion scripts. It does not run captured Framer hydration, which previously appended duplicate headers and page content. Three case studies use readable URLs and link back to the project listing. Legacy project URLs redirect to their current pages. The two academic projects retain broad NDA-limited descriptions. Contact links use the supplied email, phone and LinkedIn details.

Case-study content lives in `src/content/case-studies.json`. Run `npm run content:build` after editing it to regenerate the three static pages. The Script Change Management page retains `src/pages/projects/travel-easy/index.html` as its legacy filesystem location, but its public URL is `/portfolio/script-change-management`. Generated pages use `case-study.css` and the shared navigation/theme/motion scripts without Framer hydration. Keep public employer descriptions sanitized; deployment claims, benchmarks and links must come from the owner rather than assumptions.

The local Framer entry point mounts its optional badge only when its container exists and signals when its initial React render has committed. Shared runtime metadata uses personal page titles and the current origin for canonical URLs. The homepage states the engineering specialization, and inner pages use a primary H1. Contact and Projects keep their captured HTML/CSS layouts without Framer hydration: Contact uses the local email-draft handler, and Projects uses the editable project cards. This avoids form-value resets and template heading reflows moving links during interaction.

The pre-refactor source, HTTP fixture and browser captures are in `E:\Portfolio\backups\before-structure-refactor`.
