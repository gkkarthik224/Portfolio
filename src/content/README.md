# Portfolio content

`case-studies.json` is the editable source for the three detailed case studies.
Run `npm run content:build` to regenerate their HTML. The generated pages are
served through `config/routes.json` and use the shared case-study stylesheet.
Project listing summaries live in `src/scripts/media/portfolio-cards.js`.

The current copy uses the owner's supplied experience and project descriptions:

- Internship: April–July 2024. Ideabytes: August 2025–present. Both periods are confirmed by the owner. The public copy uses dated experience rather than the earlier approximate durations.
- Procurement: functional independent prototype; development completed; integration tested against Odoo references.
- Script Change Management: internal system in development; backend orchestration and pipeline contribution.
- Auto Defect Management: internal integration tool; evidence collection, duplicate checks and healing/logging contribution.
- Employer and academic descriptions remain sanitized under NDA. Client identities, code, tickets and internal artifacts are not published.

The extra Jira test-management product name is intentionally omitted.
The procurement video's `demoUrl` is `null` until the owner adds a link. Set it
to a complete HTTP(S) video/demo URL and rebuild to show the video walkthrough link.
No placeholder player appears while the link is unset.

Do not infer quantitative impact from model size, quantization, a technology list,
or the intended benefit of automation. Evaluation results, operating costs,
production deployment scale and public repository links have not been supplied.
Repair acceptance/approval controls are not described in the public SCM summary.
The two academic project cards stay at a broad project-area level pending further
NDA-safe material. A public repository is not required for confidential work;
use authorized sanitized evidence when available.
