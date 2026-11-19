export function contentFindings(pages) {
  const findings = [];
  const add = (page, code, severity, detail) => findings.push({ path: page.path, code, severity, detail });
  for (const page of pages) {
    if (/vexoo|framer template|creative professionals/i.test(page.title)) add(page, 'template-title', 'high', `Template metadata: ${page.title}`);
    if (!page.description.trim()) add(page, 'missing-description', 'medium', 'No meta description.');
    const h1s = page.headings.filter(heading => heading.level === 1);
    if (h1s.length !== 1) add(page, 'heading-structure', 'medium', `Expected one visible H1; found ${h1s.length}.`);
    if (page.layout.scrollWidth > page.layout.width + 1) add(page, 'overflow', 'high', 'Horizontal page overflow.');
    for (const image of page.images) {
      if (image.alt === null) add(page, 'image-alt', 'medium', `Image has no alt attribute: ${image.src}`);
      if (!image.loaded) add(page, 'image-load', 'high', `Visible image did not load: ${image.src}`);
    }
    if (page.path === '/' && !/AI|automation|integrations|image processing|backend/i.test(page.text)) add(page, 'homepage-positioning', 'high', 'Homepage text does not explain the engineering specialization.');
    if (page.path === '/contact' && page.forms.some(form => form.submitDisabled)) add(page, 'contact-form-disabled', 'medium', 'Contact form is disabled; direct contact links are the available path.');
    for (const project of page.projects) {
      if (!project.links.some(link => /case study/i.test(link.text))) add(page, 'project-case-study', 'high', `${project.title}: no case-study link surfaced in the card.`);
      if (!project.links.some(link => /source|github|gitlab|bitbucket/i.test(`${link.text} ${link.href}`))) add(page, 'project-code-evidence', 'medium', `${project.title}: no source-code link surfaced in the card; confidential work may need sanitized evidence.`);
      if (!/\b\d+(?:\.\d+)?\s*(?:%|ms|seconds?|minutes?|hours?|users?|tests?|requests?|images?|fps|x\b)/i.test(project.text)) add(page, 'project-metrics', 'medium', `${project.title}: no recognizable quantitative outcome in the card; this is a heuristic, not proof metrics are absent elsewhere.`);
    }
  }
  return findings;
}

export function markdownReport(report) {
  const lines = ['# Portfolio evidence audit', '', `Captured: ${report.capturedAt}`, `Target: ${report.baseURL}`, '', 'This is a browser evidence report, not verification of the engineer\'s claims. External destinations are inventoried but not visited. Automated accessibility scans do not establish full compliance.', '', `Pages captured: ${report.pages.length}`, `Content/link findings: ${report.findings.length}`, `Accessibility violations: ${report.accessibility.reduce((sum, result) => sum + result.violations.length, 0)}`, '', '## Content and link findings', ''];
  for (const finding of report.findings) lines.push(`- **${finding.severity}** \`${finding.path}\` (${finding.code}): ${finding.detail}`);
  for (const failure of report.captureErrors || []) lines.push(`- **capture failed** \`${failure.path}\`: ${failure.error}`);
  if (!report.findings.length) lines.push('No issues detected by the configured heuristics.');
  lines.push('', '## Accessibility findings', '');
  for (const result of report.accessibility) for (const violation of result.violations) lines.push(`- **${violation.impact || 'unknown'}** \`${result.path}\` at ${result.width}px: ${violation.id} — ${violation.help} (${violation.nodes.length} affected elements). ${violation.helpUrl}`);
  const incompleteCount = report.accessibility.reduce((sum, result) => sum + (result.incomplete?.length || 0), 0);
  lines.push('', `Checks needing manual accessibility review: ${incompleteCount}. See the incomplete arrays in evidence.json; zero automated violations does not mean the page is fully accessible.`);
  lines.push('', '## Captured pages', '');
  for (const page of report.pages) lines.push(`- \`${page.path}\`: ${page.title} — screenshot \`${page.screenshot}\``);
  return lines.join('\n') + '\n';
}
