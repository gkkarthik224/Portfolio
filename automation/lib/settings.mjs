import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const baseURL = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:8765';
const parsed = new URL(baseURL);
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
  throw new Error('PORTFOLIO_BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.');
}
export const manifest = JSON.parse(readFileSync(new URL('../../config/routes.json', import.meta.url), 'utf8'));
export const routes = Object.keys(manifest.routes);
export const slug = path => path === '/' ? 'home' : path.slice(1).replaceAll('/', '-');
export const widths = [320, 360, 390, 430, 768, 1440];
