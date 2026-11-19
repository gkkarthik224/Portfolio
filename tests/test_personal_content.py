"""Prevent retired template identity and remote content from returning."""
import json
import re
import threading
import unittest
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.request import ProxyHandler, build_opener

from server.app import ROOT, create_server


class PageContent(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.hidden = False
        self.text = []
        self.scripts = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag in {'script', 'style'}:
            self.hidden = True
        if tag == 'script' and attributes.get('src'):
            self.scripts.append(attributes['src'])

    def handle_endtag(self, tag):
        if tag in {'script', 'style'}:
            self.hidden = False

    def handle_data(self, value):
        if not self.hidden:
            self.text.append(value)


class PersonalContentTests(unittest.TestCase):
    def test_contact_details_follow_the_form_as_a_separate_panel(self):
        class ContactStructure(HTMLParser):
            def __init__(self):
                super().__init__()
                self.in_form = False
                self.panels = []
                self.details_inside_form = False

            def handle_starttag(self, tag, attributes):
                attributes = dict(attributes)
                if tag == 'form':
                    self.in_form = True
                    self.panels.append('form')
                if tag == 'aside' and attributes.get('class') == 'contact-details':
                    self.details_inside_form = self.in_form
                    self.panels.append('contact-details')

            def handle_endtag(self, tag):
                if tag == 'form':
                    self.in_form = False

        source = (ROOT / 'src/pages/contact/index.html').read_text(encoding='utf-8')
        layout = ContactStructure()
        layout.feed(source)
        self.assertFalse(layout.details_inside_form)
        self.assertEqual(layout.panels, ['form', 'form', 'contact-details'])
        self.assertEqual(source.count('class="contact-details"'), 1)
        self.assertIn('aria-labelledby="contact-details-heading"', source)

    def test_about_has_one_page_and_role_separator_is_valid(self):
        source = (ROOT / 'src/pages/about/index.html').read_text(encoding='utf-8')
        self.assertEqual(len(re.findall(r'<main\b', source)), 1)
        self.assertNotIn('/runtime/script_main', source)
        self.assertIn('/about.css?', source)
        for path in [*ROOT.glob('src/pages/**/index.html'), *ROOT.glob('public/runtime/*.mjs')]:
            with self.subTest(path=path.relative_to(ROOT)):
                content = path.read_text(encoding='utf-8')
                self.assertNotIn('AI Engineer ? System Automation', content)

    def test_active_pages_and_runtime_have_no_retired_identity(self):
        forbidden = ['soren', 'weil', 'AI Design Engineer', 'Wardou',
                     'Serilingampalle', 'WsnVxaSk0dKenAYdMT2G7bpCDAQ',
                     '7esgEDTfqoCmh2yHxI65XfkMOCI', 'Travel Easy']
        for path in [*ROOT.glob('src/pages/**/index.html'), *ROOT.glob('public/runtime/*.mjs')]:
            source = path.read_text(encoding='utf-8')
            # Flatten animated letter spans too, so a fragmented name cannot escape detection.
            if path.suffix == '.html':
                source += ''.join(PageContent(source).text)
            for old in forbidden:
                with self.subTest(path=path.relative_to(ROOT), old=old):
                    self.assertNotIn(old.lower(), source.lower())

    def test_page_runtime_and_all_local_module_imports_are_registered(self):
        manifest = json.loads((ROOT / 'config/routes.json').read_text())
        for path in ROOT.glob('src/pages/**/index.html'):
            scripts = PageContent(path.read_text(encoding='utf-8')).scripts
            self.assertFalse(any('framerusercontent.com/sites/' in script for script in scripts))
        for path in ROOT.glob('public/runtime/*.mjs'):
            source = path.read_text(encoding='utf-8')
            self.assertIn('runtime/' + path.name, manifest['files'])
            for dependency in re.findall(r'["\'`](?:\./)([^"\'`/]+\.mjs)["\'`]', source):
                self.assertTrue((path.parent / dependency).is_file(), dependency)
        collection = next(ROOT.glob('public/runtime/avuvYYzgc.*.mjs')).read_text(encoding='utf-8')
        self.assertNotIn('.framercms', collection)

    def test_legacy_pages_redirect_and_retired_assets_are_unavailable(self):
        server = create_server('127.0.0.1', 0)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        origin = f'http://127.0.0.1:{server.server_port}'
        opener = build_opener(ProxyHandler({}))
        try:
            manifest = json.loads((ROOT / 'config/routes.json').read_text())
            for old, new in manifest['redirects'].items():
                with self.subTest(old=old), opener.open(origin + old) as response:
                    self.assertEqual(response.geturl(), origin + new)
            for asset in ['/name-override.js', '/portrait-override.js', '/project-images.js', '/scenario_start.png']:
                with self.subTest(asset=asset), self.assertRaises(HTTPError) as error:
                    opener.open(origin + asset)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__ == '__main__':
    unittest.main()
