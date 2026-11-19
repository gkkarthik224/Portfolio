import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { root } from './lib/settings.mjs';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
const mode = process.argv[2] || 'test';
const extra = process.argv.slice(3);
const commands = {
  test: ['test', '--grep-invert', '@audit'],
  smoke: ['test', '--grep', '@smoke'],
  headed: ['test', '--grep-invert', '@audit', '--headed'],
  ui: ['test', '--grep-invert', '@audit', '--ui'],
  audit: ['test', '--grep', '@audit', '--project=chromium-desktop'],
  ai: ['test', '--grep', '@audit', '--project=chromium-desktop'],
  all: ['test', '--grep-invert', '@audit'],
  report: ['show-report', 'artifacts/qa/playwright-report'],
  install: ['install', 'chromium'],
};
if (!commands[mode]) throw new Error(`Unknown mode ${mode}. Use ${Object.keys(commands).join(', ')}.`);
if (mode === 'ai' && (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)) {
  console.error('qa:ai requires OPENAI_API_KEY and OPENAI_MODEL in your environment or .env. Use npm run qa:audit for a local audit and a review-in-chat.md packet without API access.');
  process.exitCode = 1;
} else {
  function run(args, env = process.env) {
    return new Promise(resolve => {
      const child = spawn(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit', windowsHide: true, env });
      child.on('error', error => { console.error(`Unable to start Playwright: ${error.message}`); resolve(1); });
      child.on('exit', code => resolve(code ?? 1));
    });
  }
  const first = await run([...commands[mode], ...extra], { ...process.env, QA_AI_REVIEW: mode === 'ai' ? '1' : '0' });
  // Always capture the evidence audit after functional tests, even on failures.
  // Separate output files preserve the functional report from being overwritten.
  if (mode === 'all') {
    const audit = await run(['test', '--grep', '@audit', '--project=chromium-desktop', '--reporter=list', '--output=artifacts/qa/audit-test-results']);
    process.exitCode = first || audit;
  } else process.exitCode = first;
}
