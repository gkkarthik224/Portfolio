import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baseURL, routes, root, slug } from '../lib/settings.mjs';
import { visit, revealPage, pageEvidence } from '../lib/page.mjs';
import { contentFindings, markdownReport } from '../lib/quality.mjs';
import { reviewInstructions, reviewPacket, requestReview, reviewMarkdown } from '../lib/ai-review.mjs';

test('@audit capture every page, audit links/accessibility, prepare AI interview', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const folder = join(root, 'artifacts', 'qa', 'audits', runId);
  await mkdir(folder, { recursive: true });
  const report = { capturedAt: new Date().toISOString(), baseURL, pages: [], accessibility: [], findings: [], externalLinks: [], captureErrors: [] };
  const runtimeErrors = new Set();
  page.on('pageerror', error => {
    const path = new URL(page.url()).pathname;
    const key = `${path}:${error.message}`;
    if (runtimeErrors.has(key)) return;
    runtimeErrors.add(key);
    report.findings.push({ path, code: 'runtime-exception', severity: 'high', detail: error.message });
  });
  // Audit is read-only, including if a third-party script attempts to send data.
  await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  const checked = new Map();
  for (const path of routes) {
    try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await visit(page, path);
    await revealPage(page);
    // A stalled image is a reported finding, not a reason to discard all pages.
    await expect.poll(() => page.locator('img:visible').evaluateAll(images => images.every(image => image.complete)), { timeout: 8_000 }).toBe(true).catch(() => {});
    const evidence = await pageEvidence(page);
    evidence.screenshot = `${slug(path)}-desktop.png`;
    await page.screenshot({ path: join(folder, evidence.screenshot), fullPage: true, animations: 'disabled' });
    report.pages.push(evidence);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      report.accessibility.push({ path, width, violations: axe.violations, incomplete: axe.incomplete });
      if (width === 390) await page.screenshot({ path: join(folder, `${slug(path)}-mobile.png`), fullPage: true, animations: 'disabled' });
    }
    for (const link of evidence.links) {
      const url = new URL(link.href, `${baseURL}${path}`);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      if (url.origin !== new URL(baseURL).origin) { report.externalLinks.push({ path, ...link, status: 'not-visited' }); continue; }
      if (checked.has(url.href)) continue;
      try {
        const response = await request.get(url.href, { timeout: 15_000 });
        checked.set(url.href, response.status());
        if (!response.ok()) report.findings.push({ path, code: 'broken-internal-link', severity: 'high', detail: `${link.text}: ${url.pathname} returned ${response.status()}.` });
      } catch {
        checked.set(url.href, 'unreachable');
        report.findings.push({ path, code: 'unreachable-internal-link', severity: 'high', detail: `${link.text}: ${url.pathname} could not be fetched within the request timeout.` });
      }
    }
    } catch (error) {
      report.captureErrors.push({ path, error: error.message.slice(0, 2000) });
    }
  }
  report.findings.push(...contentFindings(report.pages));
  const packet = reviewPacket(report);
  const chatInput = `${reviewInstructions}\n\nReview the following evidence. Provide the critique and begin asking the owner the most important missing-information questions, 3–5 at a time.\n\n${JSON.stringify(packet, null, 2)}\n`;
  await writeFile(join(folder, 'evidence.json'), JSON.stringify(report, null, 2));
  await writeFile(join(folder, 'audit.md'), markdownReport(report));
  await writeFile(join(folder, 'ai-input.json'), JSON.stringify(packet, null, 2));
  await writeFile(join(folder, 'review-in-chat.md'), chatInput);
  await writeFile(join(root, 'artifacts', 'qa', 'latest-review-in-chat.md'), chatInput);
  await writeFile(join(root, 'artifacts', 'qa', 'latest-audit.md'), markdownReport(report));
  await writeFile(join(root, 'artifacts', 'qa', 'latest-audit.json'), JSON.stringify({ folder, capturedAt: report.capturedAt }, null, 2));
  await testInfo.attach('audit', { path: join(folder, 'audit.md'), contentType: 'text/markdown' });
  console.log(`Saved audit and AI interview packet: ${folder}`);
  expect.soft(report.captureErrors, 'All configured pages should be captured; partial evidence was retained').toEqual([]);

  if (process.env.QA_AI_REVIEW === '1') {
    try {
      const result = await requestReview(packet);
      await writeFile(join(folder, 'ai-review.json'), JSON.stringify(result, null, 2));
      await writeFile(join(folder, 'ai-review.md'), reviewMarkdown(result));
      await testInfo.attach('ai-review', { path: join(folder, 'ai-review.md'), contentType: 'text/markdown' });
    } catch (error) {
      // Avoid logging request headers, credentials or provider error bodies.
      await writeFile(join(folder, 'ai-status.json'), JSON.stringify({ status: 'failed', errorType: error.name, httpStatus: error.status || null, message: 'AI review failed. Check credentials/model, quota, connectivity or evidence grounding. Local audit is retained.' }, null, 2));
      throw new Error('AI review failed; local audit and ai-status.json were saved. No successful AI review was recorded.');
    }
  }
  if (process.env.STRICT_AUDIT === '1') {
    expect.soft(report.findings.filter(f => f.severity === 'high'), 'High-priority content/link findings').toEqual([]);
    expect.soft(report.accessibility.flatMap(result => result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ path: result.path, width: result.width, id: v.id }))), 'Serious/critical accessibility violations').toEqual([]);
  }
});
