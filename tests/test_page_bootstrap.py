"""Catch a captured page booting a different route or missing its layout CSS."""
import json
import re
import unittest
from html.parser import HTMLParser

from server.app import ROOT
from server.routing import SiteRouter


class PageBootstrap(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.config = None
        self.stylesheets = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if attributes.get('id') == 'main' and 'data-framer-hydrate-v2' in attributes:
            self.config = json.loads(attributes['data-framer-hydrate-v2'])
        if tag == 'link' and attributes.get('rel') == 'stylesheet':
            self.stylesheets.append(attributes['href'])


class PageBootstrapTests(unittest.TestCase):
    def test_every_canonical_page_boots_its_own_runtime_route(self):
        router = SiteRouter(ROOT)
        runtime = (ROOT / 'public/runtime/script_main.CYlHGnGz.mjs').read_text(encoding='utf-8')
        routes = dict(re.findall(r'(\w+):\{elements:\{\},page:.*?path:`([^`]+)`\}', runtime))
        for route, alias in router.routes.items():
            page = ROOT / router.files[alias]
            bootstrap = PageBootstrap(page.read_text(encoding='utf-8')).config
            if bootstrap is None or 'pathVariables' in bootstrap:
                continue
            with self.subTest(route=route):
                self.assertEqual(routes[bootstrap['routeId']], route)

    def test_about_has_one_layout_without_a_second_runtime_mount(self):
        source = (ROOT / 'src/pages/about/index.html').read_text(encoding='utf-8')
        page = PageBootstrap(source)
        self.assertIsNone(page.config)
        self.assertIn('/about.css', [href.partition('?')[0] for href in page.stylesheets])
        self.assertEqual(len(re.findall(r'<header\b', source)), 0)
        self.assertEqual(len(re.findall(r'<main\b', source)), 1)
        self.assertEqual(len(re.findall(r'<h1\b', source)), 1)
        self.assertNotIn('data-framer-hydrate-v2', source)
        self.assertNotIn('/runtime/script_main', source)
        self.assertIn('Portrait of Karthik Krishna', source)
        css = SiteRouter(ROOT).resolve('/about.css').read_text(encoding='utf-8')
        self.assertIn('@media (max-width: 699px)', css)
        self.assertIn('grid-template-columns: minmax(0, 1fr)', css)


if __name__ == '__main__':
    unittest.main()
