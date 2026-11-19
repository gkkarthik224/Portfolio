# Reusable portfolio automation

Playwright runs the portfolio's real browser flows. A separate evidence audit uses
axe-core and content checks; an optional OpenAI review turns captured evidence
into a critique and questions for the portfolio owner. AI output never changes
the site, controls browser actions, invents selectors, or substitutes for assertions.

## First run

Requirements: Python 3.10+, Node.js 22.16+ and npm. From the repository root:

```powershell
npm ci
npm run browsers:install
npm run qa:all
```

The first two steps are already completed on this computer. `qa:all` runs the
functional suite and then the evidence audit, even if functional tests fail.
It does **not** call an AI API. Playwright starts and stops an isolated Python
server on `127.0.0.1:8765`; your existing preview on port 8080 is independent.
The QA launcher reuses the real application router and handler with a larger
TCP backlog so parallel Chromium asset requests are not refused on Windows.
If 8765 is occupied, stop that server or explicitly target an existing server.

## Commands to save and rerun

| Command | Purpose |
| --- | --- |
| `npm test` | All functional and responsive scenarios |
| `npm run test:smoke` | All canonical routes on desktop and mobile |
| `npm run test:headed` | Functional suite in visible browser windows |
| `npm run test:ui` | Interactive Playwright runner |
| `npm run test:unit` | AI grounding, refusal/error handling and audit-rule checks; no API calls |
| `npm run qa:audit` | Capture all pages, accessibility/content/link audit, screenshots and chat input |
| `npm run qa:ai` | Fresh audit plus a real AI review; requires key and model |
| `npm run qa:all` | Functional suite followed by local evidence audit |
| `npm run qa:report` | Open the most recent Playwright HTML report |

Filter a scenario or browser:

```powershell
npm test -- --project=chromium-desktop
npm test -- --grep certificate
npm test -- --grep @responsive
npm test -- --list
```

## Scenarios

The test matrix follows the canonical routes in `config/routes.json`. Use
`npm test -- --list` to see the current case count:

- Every canonical route: HTTP status, visible content, ready/loader lifecycle,
  local image loading, uncaught JavaScript exceptions, failed local assets.
- Home → About, Projects, Contact and Skills through real clicks.
- Inner navigation, current-page indicator, Back and Forward history.
- All five project cards, distinct titles, visible summaries and available case study.
- FRP/UAV certificate toggles using Enter and Space, ARIA state and stable dimensions.
- Contact email/telephone/LinkedIn destinations, validated email-draft preparation,
  safe encoding, stale-draft clearing, and no automatic message submission.
- Resume destination contract (the external document is not opened or verified).
- Theme persistence through the public theme API, reload and navigation. This does
  not claim that a user-facing theme toggle exists in the current layout.
- Loader behavior with external resources blocked and ordinary animation enabled.
- All canonical routes at 320, 360, 390, 430, 768 and 1440px: overflow, navigation and screenshots.
- All configured legacy redirects and an intentional 404.

Desktop and Pixel 7 Chromium projects run by default. Tests use reduced motion
except the explicit normal-motion scenario. The audit additionally captures
desktop/mobile screenshots and runs WCAG A/AA axe scans at both widths.

## Reports and saved chat input

Functional reports are refreshed on each run:

- `artifacts/qa/playwright-report/index.html` — interactive results and attachments.
- `artifacts/qa/results.json` and `junit.xml` — machine-readable results.
- `artifacts/qa/test-results/` — failure screenshots, video and traces.

Audits are retained in timestamped folders under `artifacts/qa/audits/`:

- `audit.md` — content, internal-link and accessibility findings.
- `evidence.json` — page text, links, images, form configuration and raw axe results.
- `*-desktop.png`, `*-mobile.png` — page captures.
- `ai-input.json` — reduced evidence payload.
- `review-in-chat.md` — ready-to-paste context and instructions for the content interview.
- `ai-review.md`, `ai-review.json` — present only after a successful API review.
- `ai-status.json` — retained if the API review fails.

`artifacts/qa/latest-audit.json` identifies the latest audit folder. Copy the
contents of `review-in-chat.md` into your chat to receive evidence-based questions
in batches of 3–5. Answer those questions to develop your case studies.
The most recent audit and chat packet also have stable shortcuts:
`artifacts/qa/latest-audit.md` and `artifacts/qa/latest-review-in-chat.md`.

## Enable the optional AI review

Copy `.env.example` to `.env`, then set:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=your-structured-output-capable-model
AI_MAX_OUTPUT_TOKENS=6000
```

```powershell
npm run qa:ai
```

This explicit command sends captured portfolio text, headings, links, project
summaries and summarized audit findings to OpenAI. It does not send screenshots,
cookies, storage, filled form values, or repository source. Public contact text
visible on the pages can appear in the payload. Review `ai-input.json` from a
local audit first if needed. API usage is billed separately according to your
account; a ChatGPT session is not used as an API credential.

The implementation uses the Responses API with Structured Outputs, `store: false`,
one bounded request and no automatic retries. The chosen model must support this
API and the structured schema. Every finding must cite a captured route and an
exact text quote; invalid quotes, unknown routes, refusals and incomplete outputs
fail the review. Quote validation proves the quotation exists, not that the
model's interpretation is correct. Review its recommendations before using them.

Without a key/model, `qa:ai` exits with an explanatory error. Use `qa:audit` and
the saved chat packet instead. Credentials are never placed in browser code.

## Other targets and browsers

To review an already-running preview or deployed version:

```powershell
$env:PORTFOLIO_BASE_URL = 'http://127.0.0.1:8080'
npm run qa:all
Remove-Item Env:PORTFOLIO_BASE_URL
```

Use only the origin, without a path or credentials. Setting this variable
disables automatic server startup. The server must expose the same routes.

To enable Firefox and WebKit too:

```powershell
npm run browsers:install -- firefox webkit
$env:QA_CROSS_BROWSER = '1'
npm test
Remove-Item Env:QA_CROSS_BROWSER
```

Optional `.env` settings are loaded by the npm commands. `QA_WORKERS` defaults
to 2. CI has one retry and rejects focused tests. Dependencies are pinned in
`package-lock.json` for reproducible installation.

## What counts as a failure

Functional assertions fail on broken behavior. External HTTP/network failures
are attached as diagnostics, separate from local asset failures. A failed
third-party resource that prevents a required interaction will still fail that
interaction. The tests never claim external resume/repository availability.

The audit reports existing content/accessibility gaps without treating every
editorial gap as a broken application. To enforce its quality threshold:

```powershell
$env:STRICT_AUDIT = '1'
npm run qa:audit
Remove-Item Env:STRICT_AUDIT
```

Strict mode fails on high-priority content/internal-link/runtime findings and serious
or critical axe violations. It saves the evidence before failing. Missing source
links and metric patterns are explicitly scoped heuristics; confidential work may
need alternative evidence. Automated accessibility scans need manual follow-up.

## Maintain the suite

- Routes/redirects come from `config/routes.json`; viewport widths live in
  `automation/lib/settings.mjs`.
- Browser scenarios live in `automation/specs/`.
- Content rules live in `automation/lib/quality.mjs`.
- The AI rubric/schema live in `automation/lib/ai-review.mjs`.
- Update intentional project count, link contracts and form expectations when
  the site changes. Do not weaken assertions to conceal regressions.
- No screenshot baselines are silently approved. Screenshots are review evidence,
  not pixel-diff regression assertions.
- This suite does not load-test backend systems or verify the portfolio owner's
  accomplishments. It exercises this portfolio website and audits its evidence.

Implementation references: [Playwright configuration](https://playwright.dev/docs/test-configuration),
[Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing),
[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
