import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const manifest = JSON.parse(await readFile(resolve(root, 'config/routes.json'), 'utf8'));
const assetVersions = new Map();
for (const [name, source] of Object.entries(manifest.files)) {
  if (!name.endsWith('.html')) {
    const bytes = await readFile(resolve(root, source));
    assetVersions.set(`/${name}`, createHash('sha256').update(bytes).digest('hex').slice(0, 12));
  }
}

async function write(relative, content) {
  const target = resolve(output, relative);
  if (!target.startsWith(output + '/') && !target.startsWith(output + '\\')) throw new Error('Invalid output path');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function staticHtml(html) {
  // Hosted directory routes can end in a slash. Keep their relative assets
  // resolving from the same root used by the local routing server.
  return html.replace(/<head\b[^>]*>/i, '$&\n  <base href="/">')
    .replace(/(<(?:script|link|img)\b[^>]*?\b(?:src|href)=)(["'])([^"']+)\2/gi,
      (match, prefix, quote, value) => {
        const url = new URL(value, 'https://portfolio.invalid/');
        const version = url.origin === 'https://portfolio.invalid' && assetVersions.get(url.pathname);
        if (!version) return match;
        // Give each changed asset a fresh URL on browsers and GitHub's CDN.
        url.searchParams.set('v', version);
        return `${prefix}${quote}${url.pathname}${url.search}${url.hash}${quote}`;
      });
}

for (const [name, source] of Object.entries(manifest.files)) {
  if (name.endsWith('.html')) {
    await write(name, staticHtml(await readFile(resolve(root, source), 'utf8')));
  } else {
    const target = resolve(output, name);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(root, source), target);
  }
}
for (const [route, name] of Object.entries(manifest.routes)) {
  await write(route === '/' ? 'index.html' : `${route.slice(1)}/index.html`,
    staticHtml(await readFile(resolve(root, manifest.files[name]), 'utf8')));
}
for (const [route, target] of Object.entries(manifest.redirects)) {
  const name = route.endsWith('.html') ? route.slice(1) : `${route.slice(1)}/index.html`;
  // GitHub Pages resolves /portfolio to portfolio.html before the directory.
  // Redirect to the directory explicitly so legacy .html aliases cannot loop.
  const destination = target !== '/' && manifest.routes[target] ? `${target}/` : target;
  await write(name, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${destination}"><title>Redirecting</title></head><body><a href="${destination}">Continue</a></body></html>\n`);
}
await write('404.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not found</title></head><body><h1>Page not found</h1><a href="/">Return home</a></body></html>\n');
console.log(`Exported ${Object.keys(manifest.routes).length} pages and ${Object.keys(manifest.files).length} mapped files to dist.`);
