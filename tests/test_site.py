"""Checks for the production export; uses only Node and Python's standard library."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import unittest
from urllib.parse import parse_qs, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
ORIGIN = 'https://portfolio.invalid'


class Resources(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.urls = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img') and attrs.get('src'):
            self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('href') and any(rel in attrs.get('rel', '') for rel in ('stylesheet', 'icon', 'modulepreload')):
            self.urls.append(attrs['href'])


class SiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for script in ['build-case-studies.mjs', 'build-static.mjs']:
            subprocess.run(['node', str(ROOT / 'scripts' / script)], cwd=ROOT, check=True, capture_output=True)
        cls.manifest = json.loads((ROOT / 'config/routes.json').read_text(encoding='utf-8'))

    def export_file(self, path):
        """GitHub can prefer /portfolio.html over /portfolio/index.html."""
        path = path.lstrip('/')
        candidates = [path + 'index.html'] if path.endswith('/') or not path else [path, path + '.html', path + '/index.html']
        for name in candidates:
            file = DIST / name
            if file.is_file():
                return file
        self.fail(f'Missing exported URL: /{path}')

    def test_canonical_pages_and_versioned_resources(self):
        for route in self.manifest['routes']:
            with self.subTest(route=route):
                path = '/' if route == '/' else route + '/'
                source = self.export_file(path).read_text(encoding='utf-8')
                self.assertIn('<base href="/">', source)
                self.assertNotIn('http-equiv="refresh"', source)
                for resource in Resources(source).urls:
                    url = urlsplit(urljoin(ORIGIN + '/', resource))
                    if url.netloc != 'portfolio.invalid':
                        continue
                    name = url.path.lstrip('/')
                    self.assertIn(name, self.manifest['files'], f'Unmapped resource in {route}: {resource}')
                    data = (DIST / name).read_bytes()
                    if not name.endswith('.html'):
                        self.assertEqual(parse_qs(url.query).get('v'), [hashlib.sha256(data).hexdigest()[:12]], resource)

    def test_all_routes_and_legacy_redirects_terminate(self):
        for route in [*self.manifest['routes'], *self.manifest['redirects']]:
            current, seen = route, set()
            while True:
                self.assertNotIn(current, seen, f'Redirect loop from {route}')
                seen.add(current)
                self.assertLess(len(seen), 10)
                source = self.export_file(current).read_text(encoding='utf-8')
                match = re.search(r'http-equiv="refresh" content="0;url=([^"]+)"', source)
                if not match:
                    self.assertIn('<base href="/">', source)
                    break
                current = match[1]

    def test_manifest_targets_and_public_aliases(self):
        from server.routing import SiteRouter
        router = SiteRouter(ROOT)
        for name, source in self.manifest['files'].items():
            with self.subTest(name=name):
                self.assertTrue((ROOT / source).is_file())
                self.assertTrue((DIST / name).is_file())
                self.assertEqual(router.resolve('/' + name + '?v=cache-check'), ROOT / source)
        self.assertIsNone(router.resolve('/../package.json'))
        self.assertIsNone(router.resolve('/unknown'))

    def test_local_runtime_imports_remain_available(self):
        for file in (ROOT / 'public/runtime').glob('*.mjs'):
            for reference in re.findall(r'''["'`](\./[^"'`\s]+\.mjs)["'`]''', file.read_text(encoding='utf-8')):
                with self.subTest(module=file.name, reference=reference):
                    self.assertTrue((file.parent / reference).is_file())
                    self.assertTrue((DIST / 'runtime' / Path(reference).name).is_file())

    def test_certificate_and_deployed_project_records(self):
        script = (ROOT / 'src/scripts/media/portfolio-cards.js').read_text(encoding='utf-8')
        self.assertEqual(script.count("certificate: {image: 'iit-bombay-internship-certificate.jpeg'}"), 2)
        image = DIST / 'project-images/iit-bombay-internship-certificate.jpeg'
        self.assertTrue(image.read_bytes().startswith(b'\xff\xd8'))
        self.assertIn("status: 'Deployed'", script)
        study = next(item for item in json.loads((ROOT / 'src/content/case-studies.json').read_text(encoding='utf-8')) if item['id'] == 'defect-management')
        self.assertEqual(study['status'], 'Deployed')
        self.assertIn('FastAPI', study['tools'])

    def test_custom_javascript_syntax(self):
        for file in (ROOT / 'src/scripts').rglob('*.js'):
            result = subprocess.run(['node', '--check', str(file)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
