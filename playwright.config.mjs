import { defineConfig, devices } from '@playwright/test';
import { baseURL, root } from './automation/lib/settings.mjs';

const desktop = { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } };
const mobile = { name: 'chromium-mobile', testIgnore: /responsive\.spec\.mjs/, use: { ...devices['Pixel 7'] } };

export default defineConfig({
  testDir: './automation/specs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: Number(process.env.QA_WORKERS || 2),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: 'artifacts/qa/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/qa/playwright-report', open: 'never' }],
    ['json', { outputFile: 'artifacts/qa/results.json' }],
    ['junit', { outputFile: 'artifacts/qa/junit.xml' }],
  ],
  use: {
    baseURL,
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  },
  projects: [desktop, mobile, ...(process.env.QA_CROSS_BROWSER === '1' ? [
    { name: 'firefox-desktop', testIgnore: /responsive\.spec\.mjs/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', testIgnore: /responsive\.spec\.mjs/, use: { ...devices['Desktop Safari'] } },
  ] : [])],
  webServer: process.env.PORTFOLIO_BASE_URL ? undefined : {
    command: 'python -m automation.serve',
    url: baseURL,
    cwd: root,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
