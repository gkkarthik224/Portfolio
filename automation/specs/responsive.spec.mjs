import { test, expect } from '@playwright/test';
import { routes, widths, slug } from '../lib/settings.mjs';
import { visit, revealPage } from '../lib/page.mjs';

for (const width of widths) for (const path of routes) {
  test(`@responsive ${slug(path)} at ${width}px: no overflow, usable navigation`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, path);
    await revealPage(page);
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    expect(layout.content, 'Horizontal page overflow').toBeLessThanOrEqual(layout.width + 1);
    if (path === '/') {
      await expect(page.getByRole('link', { name: /Projects/ }).first()).toBeVisible();
    } else {
      const current = page.locator('.cell-top-menu [aria-current="page"]');
      await expect(current).toBeVisible();
      const bounds = await current.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    await testInfo.attach(`${slug(path)}-${width}px`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
  });
}
