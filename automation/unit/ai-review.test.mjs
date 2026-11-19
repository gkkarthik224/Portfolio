import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requestReview, reviewPacket, validateGrounding } from '../lib/ai-review.mjs';
import { contentFindings } from '../lib/quality.mjs';

const packet = { pages: [{ path: '/portfolio', title: 'Projects', description: '', text: 'An AI testing prototype.', links: [] }] };
const validReview = { executiveSummary: 'Evidence is limited.', strengths: [], fullTimeScore: 4, freelanceScore: 3, scoreRationale: 'Prototype evidence only.', findings: [{ severity: 'high', kind: 'inference', path: '/portfolio', evidenceQuote: 'An AI testing prototype.', issue: 'Outcome unclear', action: 'Explain evaluation.', questionForOwner: 'How was it evaluated?' }], prioritizedNextSteps: [], interviewQuestions: [] };

test('rejects fabricated quotes, uncaptured pages and invalid scores', () => {
  assert.deepEqual(validateGrounding(validReview, packet), validReview);
  assert.throws(() => validateGrounding({ ...validReview, findings: [{ ...validReview.findings[0], evidenceQuote: 'Saved 100 hours' }] }, packet), /ungrounded quote/);
  assert.throws(() => validateGrounding({ ...validReview, findings: [{ ...validReview.findings[0], path: '/secret' }] }, packet), /uncaptured page/);
  assert.throws(() => validateGrounding({ ...validReview, fullTimeScore: 11 }, packet));
});

test('AI request uses schema, disables storage and returns validated results', async () => {
  let input;
  const client = { responses: { parse: async request => { input = request; return { status: 'completed', output_parsed: validReview, id: 'mock-response', model: 'mock-model', usage: { input_tokens: 100, output_tokens: 100 } }; } } };
  const result = await requestReview(packet, { client, model: 'mock-model' });
  assert.equal(input.store, false);
  assert.equal(input.text.format.type, 'json_schema');
  assert.equal(result.review.fullTimeScore, 4);
});

test('AI refusal, truncation and transport errors cannot become successful reviews', async () => {
  for (const response of [{ status: 'incomplete', output_parsed: validReview }, { status: 'completed', output_parsed: null }]) {
    await assert.rejects(requestReview(packet, { model: 'mock-model', client: { responses: { parse: async () => response } } }), /incomplete or refused/);
  }
  await assert.rejects(requestReview(packet, { model: 'mock-model', client: { responses: { parse: async () => { throw new Error('network unavailable'); } } } }), /network unavailable/);
});

test('AI packet excludes browser storage, form values and full accessibility HTML', () => {
  const report = { capturedAt: 'now', pages: [{ ...packet.pages[0], cookies: 'secret', forms: [{ value: 'private' }] }], findings: [], accessibility: [{ path: '/', width: 390, violations: [{ id: 'x', impact: 'serious', help: 'Fix', nodes: [{ html: 'private' }] }] }] };
  const serialized = JSON.stringify(reviewPacket(report));
  assert.ok(!serialized.includes('secret'));
  assert.ok(!serialized.includes('private'));
});

test('quality checks scope missing evidence to the project card', () => {
  const findings = contentFindings([{ path: '/portfolio', title: 'Projects', description: 'Projects', headings: [{ level: 1 }], layout: { width: 390, scrollWidth: 390 }, images: [], forms: [], projects: [{ title: 'Example', text: 'A prototype', links: [] }] }]);
  assert.ok(findings.some(f => f.code === 'project-case-study'));
  assert.ok(findings.find(f => f.code === 'project-code-evidence').detail.includes('in the card'));
});

test('AI CLI without credentials exits before launching a browser or making API calls', () => {
  const result = spawnSync(process.execPath, ['automation/run.mjs', 'ai'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, OPENAI_API_KEY: '', OPENAI_MODEL: '', PORTFOLIO_BASE_URL: '' },
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires OPENAI_API_KEY and OPENAI_MODEL/);
  assert.ok(!result.stdout.includes('Running '));
});
