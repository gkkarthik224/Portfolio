import { test, expect } from '@playwright/test';
import { routes, manifest } from '../lib/settings.mjs';
import { visit, revealPage } from '../lib/page.mjs';

for (const path of routes) {
  test(`@smoke ${path}: loads, renders and has no local resource failures`, async ({ page, baseURL }, testInfo) => {
    const errors = [], localFailures = [], externalFailures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() < 400) return;
      const failure = { url: response.url(), status: response.status() };
      (new URL(response.url()).origin === new URL(baseURL).origin ? localFailures : externalFailures).push(failure);
    });
    page.on('requestfailed', request => {
      if (request.failure()?.errorText?.includes('ERR_ABORTED')) return;
      const failure = { url: request.url(), error: request.failure()?.errorText };
      (new URL(request.url()).origin === new URL(baseURL).origin ? localFailures : externalFailures).push(failure);
    });
    await visit(page, path);
    await revealPage(page);
    await expect(page.locator('h1:visible,h2:visible').first()).toBeVisible();
    await expect(page.locator('h1:visible')).toHaveCount(1);
    await expect(page).not.toHaveTitle(/Vexoo|Framer Template/i);
    await expect(page.locator('body')).toContainText('Karthik');
    await expect.soft.poll(() => page.locator('img:visible').evaluateAll(images => images.filter(image => new URL(image.currentSrc || image.src).origin === location.origin).every(image => image.complete && image.naturalWidth > 0)), { timeout: 12_000, message: 'Visible local images should load' }).toBe(true);
    const images = await page.locator('img:visible').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => ({ src: image.currentSrc || image.src, loading: image.loading, complete: image.complete })));
    await testInfo.attach('runtime-diagnostics', { body: JSON.stringify({ errors, localFailures, externalFailures, unloadedImages: images }, null, 2), contentType: 'application/json' });
    expect.soft(errors, 'Uncaught JavaScript exceptions').toEqual([]);
    expect.soft(localFailures, 'Failed same-origin resources').toEqual([]);
  });
}

test('canonical routes, legacy redirects and missing pages have correct HTTP status', async ({ request }) => {
  for (const path of routes) expect((await request.get(path)).status(), path).toBe(200);
  for (const [from, to] of Object.entries(manifest.redirects)) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect([301, 302, 307, 308], from).toContain(response.status());
    expect(new URL(response.headers().location, response.url()).pathname, from).toBe(to);
  }
  expect((await request.get('/qa-intentionally-missing-page')).status()).toBe(404);
});
