import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const reportPath = resolve(root, 'reports/code-metrics.json');
const languages = {'.html': 'HTML', '.css': 'CSS', '.js': 'JavaScript', '.mjs': 'JavaScript', '.py': 'Python'};
const generated = new Set([
  'src/pages/projects/travel-easy/index.html',
  'src/pages/projects/procurement-erp/index.html',
  'src/pages/projects/defect-management/index.html'
]);
const groupFor = name => name.startsWith('public/runtime/') ? 'Bundled runtime'
  : generated.has(name) ? 'Generated case studies'
  : name.startsWith('src/') ? 'Application source' : 'Build, preview and tests';

function summarize(files) {
  const groups = {}, byLanguage = {};
  let codeFiles = 0, codeLines = 0, codeBytes = 0, textLines = 0, bytes = 0;
  for (const file of files) {
    bytes += file.bytes;
    textLines += file.lines ?? 0;
    const language = languages[extname(file.path)];
    if (!language) continue;
    codeFiles++; codeLines += file.lines; codeBytes += file.bytes;
    for (const [table, key] of [[groups, groupFor(file.path)], [byLanguage, language]]) {
      const item = table[key] ??= {files: 0, lines: 0, bytes: 0};
      item.files++; item.lines += file.lines; item.bytes += file.bytes;
    }
  }
  return {files: files.length, bytes, textLines, codeFiles, codeLines, codeBytes, groups, byLanguage};
}

const names = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {cwd: root, encoding: 'utf8'}).split('\0'))].filter(name => name && !name.startsWith('reports/'));
const files = [];
for (const name of names) {
  const path = resolve(root, name);
  try { if (!(await stat(path)).isFile()) continue; } catch { continue; }
  const data = await readFile(path);
  let lines = null;
  try {
    const text = new TextDecoder('utf-8', {fatal: true}).decode(data);
    lines = text ? text.split(/\r\n|\r|\n/).length - (/[\r\n]$/.test(text) ? 1 : 0) : 0;
  } catch { /* Binary assets have byte counts, not line counts. */ }
  files.push({path: name.replaceAll('\\', '/'), bytes: data.length, lines});
}
files.sort((a, b) => a.path.localeCompare(b.path));
const current = summarize(files);
let previous = {};
try { previous = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
const baselineFlag = process.argv.indexOf('--baseline');
const baseline = baselineFlag >= 0
  ? JSON.parse(await readFile(process.argv[baselineFlag + 1], 'utf8')) : null;
const before = baseline ? summarize(baseline) : previous.before;
const report = {
  generatedAtUtc: new Date().toISOString(),
  methodology: 'Physical lines in tracked/unignored source files. Code includes HTML, CSS, JS/MJS and Python. Config, documentation and SVG are outside code totals. Reports, dependencies, build output and artifacts are excluded. Minified runtime is counted as stored, not pretty-printed.',
  ...(before ? {before, reduction: {
    files: before.files - current.files, bytes: before.bytes - current.bytes,
    codeLines: before.codeLines - current.codeLines, textLines: before.textLines - current.textLines
  }} : {}),
  current,
  removed: baseline ? baseline.filter(file => !files.some(current => current.path === file.path)) : previous.removed ?? [],
  largestFiles: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 10),
  files
};
await mkdir(resolve(root, 'reports'), {recursive: true});
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({report: 'reports/code-metrics.json', ...current}, null, 2));
