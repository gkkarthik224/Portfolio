import { test, expect } from '@playwright/test';
import { visit, ready, visibleLink } from '../lib/page.mjs';

for (const path of ['/about', '/portfolio', '/contact']) {
  test(`homepage card navigates to ${path}`, async ({ page }) => {
    await visit(page, '/');
    await (await visibleLink(page, path)).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await ready(page);
  });
}

test('Skills entry opens the Skills page', async ({ page }) => {
  await visit(page, '/');
  await page.getByRole('link', { name: 'Explore skills' }).click();
  await expect(page).toHaveURL(/\/skills(?:\.html)?$/);
  await ready(page);
  await expect(page.locator('main')).toContainText('Languages');
});

test('inner menu supports a recruiter journey and browser history', async ({ page }) => {
  await visit(page, '/about');
  for (const path of ['/portfolio', '/skills', '/contact']) {
    await (await visibleLink(page, path)).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await ready(page);
    await expect(page.locator('.cell-top-menu [aria-current="page"]')).toHaveAttribute('href', path);
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/skills$/);
  await ready(page);
  await page.goForward();
  await expect(page).toHaveURL(/\/contact$/);
  await ready(page);
});

test('projects render distinct summaries and open the available case study', async ({ page }) => {
  await visit(page, '/portfolio');
  const cards = page.locator('.portfolio-project-card');
  await expect(cards).toHaveCount(5);
  const titles = await cards.locator('h3').allTextContents();
  expect(new Set(titles).size).toBe(5);
  for (const card of await cards.all()) {
    await expect(card.locator('h3')).not.toBeEmpty();
    await expect(card.locator('.portfolio-project-summary')).not.toBeEmpty();
    await expect(card.locator('.portfolio-project-overview > p:not(.portfolio-project-evidence)')).not.toBeEmpty();
  }
  await page.getByRole('link', { name: 'View case study' }).first().click();
  await expect(page).toHaveURL(/\/portfolio\/script-change-management$/);
  await ready(page);
  await expect(page.locator('h1:visible,h2:visible').first()).toBeVisible();
  await expect(page.locator('main')).toContainText('Ideabytes');
  await page.getByRole('link', { name: 'All projects', exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await ready(page);
});

test('project titles are centered and card text stays visible while scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await visit(page, '/portfolio');
  const section = page.locator('#portfolio-projects');
  const card = section.getByRole('article').last();
  const animatedText = section.locator('[data-scroll-text], [data-motion-pending]');
  await expect(card.getByRole('heading')).toHaveCSS('text-align', 'center');
  await expect(card.locator('.portfolio-project-summary')).toHaveCSS('text-align', /^(start|left)$/);
  await expect(animatedText).toHaveCount(0);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveCSS('opacity', '1');
  await expect(animatedText).toHaveCount(0);
});

for (const scenario of [
  { title: 'Smart Procurement ERP Logging System', path: '/portfolio/procurement-erp', status: 'Functional prototype', evidence: 'Odoo references' },
  { title: 'Auto Defect Management System', path: '/portfolio/defect-management', status: 'Internal integration tool', evidence: 'confidential under NDA' },
]) {
  test(`${scenario.title}: card opens a scoped case study and returns to Projects`, async ({ page }, testInfo) => {
    await visit(page, '/portfolio');
    const caseLink = page.getByRole('article', { name: scenario.title, exact: true }).getByRole('link', { name: 'View case study', exact: true });
    if (testInfo.project.use.hasTouch) await caseLink.tap();
    else await caseLink.click();
    await expect(page).toHaveURL(new RegExp(`${scenario.path}$`));
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(scenario.title);
    await expect(page.locator('.case-facts')).toContainText(scenario.status);
    await expect(page.locator('main')).toContainText(scenario.evidence);
    await expect(page.getByRole('list', { name: 'High-level workflow' }).getByRole('listitem')).not.toHaveCount(0);
    await page.getByRole('link', { name: 'All projects', exact: true }).click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await ready(page);
  });
}

for (const title of ['FRP Material Strength Analyser', 'UAV Crack Detection System']) {
  test(`${title}: certificate toggles using keyboard without resizing card`, async ({ page }) => {
    await visit(page, '/portfolio');
    const card = page.getByRole('article', { name: title, exact: true });
    const button = card.getByRole('button');
    await button.scrollIntoViewIfNeeded();
    const before = await card.boundingBox();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('.portfolio-project-certificate')).toHaveAttribute('aria-hidden', 'false');
    // Supports the current honest placeholder and future real certificates.
    await expect(card.locator('.portfolio-project-certificate')).not.toBeEmpty();
    const after = await card.boundingBox();
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2);
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(card.locator('.portfolio-project-certificate')).toHaveAttribute('aria-hidden', 'true');
  });
}

test('contact channels work and form prepares a reviewed email draft without sending', async ({ page }) => {
  const writes = [];
  await page.route('**/*', async route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      writes.push({ method: route.request().method(), url: route.request().url() });
      return route.abort();
    }
    return route.continue();
  });
  await visit(page, '/contact');
  await expect(page.locator('a[href^="mailto:"]:visible').first()).toHaveAttribute('href', /^mailto:[^@\s]+@[^\s]+$/);
  await expect(page.locator('a[href^="tel:"]:visible').first()).toHaveAttribute('href', /^tel:\+\d+$/);
  await expect(page.locator('a[href*="linkedin.com/in/"]:visible').first()).toHaveAttribute('href', /^https:\/\//);
  await page.locator('input[name="Name"]:visible').fill('QA Test — do not send');
  await page.locator('input[name="Email"]:visible').fill('qa@example.com');
  await page.locator('textarea[name="Details"]:visible').fill('Automated local validation only.');
  await page.getByRole('button', { name: 'Prepare email draft', exact: true }).click();
  const draft = page.getByRole('link', { name: 'Open email draft', exact: true });
  await expect(draft).toBeVisible();
  const href = new URL(await draft.getAttribute('href'));
  expect(href.protocol).toBe('mailto:');
  expect(href.pathname).toBe('gkrishankarthik2004@gmail.com');
  expect(href.searchParams.get('subject')).toBe('Portfolio enquiry from QA Test — do not send');
  expect(href.searchParams.get('body')).toContain('qa@example.com');
  expect(href.searchParams.get('body')).toContain('Automated local validation only.');
  await expect(page.getByRole('status').filter({ hasText: 'Your draft is ready.' })).toBeVisible();
  await page.locator('textarea[name="Details"]:visible').fill('Revised message');
  await expect(draft).toBeHidden();
  await page.locator('input[name="Email"]:visible').fill('invalid-email');
  await page.getByRole('button', { name: 'Prepare email draft', exact: true }).click();
  await expect(draft).toBeHidden();
  await expect(page.getByRole('tabpanel', { name: 'Form', exact: true }).locator('form')).not.toHaveAttribute('action', /https?:/);
  expect(writes, 'No form or other write requests should be sent').toEqual([]);
});

test('contact tabs prepare a procurement demo request by email or phone', async ({ page }) => {
  await visit(page, '/contact');
  const form = page.getByRole('tab', { name: 'Form', exact: true });
  const demo = page.getByRole('tab', { name: 'Demo', exact: true });
  await expect(form).toHaveAttribute('aria-selected', 'true');
  const name = page.locator('input[name="Name"]');
  await name.fill('QA draft');
  await form.press('ArrowRight');
  await expect(demo).toBeFocused();
  await expect(demo).toHaveAttribute('aria-selected', 'true');
  await expect(name).toBeHidden();

  const panel = page.getByRole('tabpanel', { name: 'Demo', exact: true });
  const project = panel.getByRole('combobox', { name: 'Project' });
  await expect(project).toHaveValue('procurement-erp');
  await expect(project.locator('option')).toHaveText(['Smart Procurement ERP Logging System']);
  const reply = panel.getByRole('textbox', { name: 'Your email or phone number' });
  const requestDemo = panel.getByRole('button', { name: 'Request for demo', exact: true });
  const draft = panel.getByRole('link', { name: 'Open email draft', exact: true });
  await requestDemo.click();
  await expect(reply).toBeFocused();
  await expect(draft).toBeHidden();
  await reply.fill('invalid');
  await requestDemo.click();
  expect(await reply.evaluate(input => input.validationMessage)).toBe('Enter a valid email address or phone number.');
  await expect(draft).toBeHidden();

  for (const [contact, bodyLine] of [['qa+demo@example.com', 'My email'], ['+1 (202) 555-0143', 'My phone number']]) {
    await reply.fill(contact);
    await expect(draft).toBeHidden();
    await requestDemo.click();
    await expect(draft).toBeFocused();
    const url = new URL(await draft.getAttribute('href'));
    expect(url.protocol).toBe('mailto:');
    await expect(page.locator('.contact-details a[href^="mailto:"]')).toHaveAttribute('href', `mailto:${url.pathname}`);
    expect(url.searchParams.get('subject')).toBe('Demo request: Smart Procurement ERP Logging System');
    expect(url.searchParams.get('body')).toContain(`${bodyLine}: ${contact}`);
  }

  await form.click();
  await expect(panel).toBeHidden();
  await expect(name).toBeVisible();
  await expect(name).toHaveValue('QA draft');
  await demo.click();
  await expect(reply).toHaveValue('+1 (202) 555-0143');
});

test('resume points to an external document without navigating to it', async ({ page }) => {
  await visit(page, '/');
  await expect(page.getByRole('link', { name: /Resume/ }).first()).toHaveAttribute('href', /^https:\/\/drive\.google\.com\/file\/d\//);
});

test('theme preference persists through reload and navigation', async ({ page }) => {
  await visit(page, '/about');
  await expect(page.locator('html')).toHaveAttribute('framestack-theme', 'dark');
  // The current design hides theme controls; exercise its public state API explicitly.
  await page.evaluate(() => window.PortfolioTheme.set('light'));
  await expect(page.locator('html')).toHaveAttribute('framestack-theme', 'light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('framestack-theme', 'light');
  await (await visibleLink(page, '/portfolio')).click();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('framestack-theme', 'light');
});

test('loader releases the page when third-party resources are unavailable', async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin ? route.abort('failed') : route.continue();
  });
  await visit(page, '/about');
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
});

test('normal motion finishes loading and enables navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await visit(page, '/about');
  await (await visibleLink(page, '/portfolio')).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await ready(page);
});
