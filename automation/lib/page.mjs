import { expect } from '@playwright/test';

export async function ready(page) {
  await expect(page.locator('html')).toHaveAttribute('data-page-ready', '', { timeout: 15_000 });
  if (await page.locator('script[src*="/runtime/script_main"]').count()) {
    await expect(page.locator('html')).toHaveAttribute('data-runtime-ready', '', { timeout: 15_000 });
  }
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-page-loading');
}

export async function visit(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${path} HTTP response`).toBe(200);
  await ready(page);
}

export async function visibleLink(page, path) {
  const link = page.locator(`a[href="${path}"], a[href=".${path}"]`).filter({ visible: true }).first();
  await expect(link, `Visible link to ${path}`).toBeVisible();
  return link;
}

export async function revealPage(page) {
  // Trigger lazy images and intersection-observer entrances, including long pages.
  await page.evaluate(async () => {
    const step = Math.max(300, innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    scrollTo(0, 0);
  });
}

export async function pageEvidence(page) {
  return page.evaluate(() => {
    const visible = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
    const text = node => (node.innerText || node.textContent || '').trim();
    return {
      path: location.pathname,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      text: document.body.innerText.slice(0, 40_000),
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map(node => ({ level: Number(node.tagName[1]), text: text(node) })),
      links: [...document.querySelectorAll('a[href]')].filter(visible).map(node => ({ text: text(node) || node.getAttribute('aria-label') || '', href: node.getAttribute('href') })),
      projects: [...document.querySelectorAll('.portfolio-project-card')].map(node => ({ title: node.querySelector('h3')?.textContent || '', text: text(node), links: [...node.querySelectorAll('a[href]')].map(a => ({ text: text(a), href: a.getAttribute('href') })) })),
      images: [...document.images].filter(visible).map(node => ({ src: node.currentSrc || node.src, alt: node.getAttribute('alt'), loaded: node.complete && node.naturalWidth > 0 })),
      forms: [...document.forms].map(form => ({ action: form.getAttribute('action'), method: form.method, submitDisabled: [...form.querySelectorAll('[type="submit"]')].every(node => node.disabled) })),
      layout: { width: innerWidth, scrollWidth: document.documentElement.scrollWidth },
    };
  });
}
