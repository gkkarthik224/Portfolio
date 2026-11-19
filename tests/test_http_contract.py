"""Check real HTTP responses against the pre-refactor site, including aliases."""
import hashlib
import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

from server.app import ROOT, create_server


class HttpContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = create_server('127.0.0.1', 0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.baseline = json.loads((ROOT / 'tests' / 'fixtures' / 'http-baseline.json').read_text())

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_existing_responses_are_byte_identical(self):
        for path, expected in self.baseline.items():
            with self.subTest(path=path), urlopen(self.origin + path, timeout=5) as response:
                self.assertEqual(response.status, expected['status'])
                self.assertEqual(response.headers['Content-Type'], expected['type'])
                self.assertEqual(hashlib.sha256(response.read()).hexdigest(), expected['sha256'])
                self.assertEqual(response.headers['Cache-Control'], 'no-cache')

    def test_nested_assets_and_version_queries(self):
        for name in ['personal-layout.js', 'theme-sync.js', 'local-customizations.css', 'portfolio-cards.js', 'portfolio-cards.css', 'project-images/ai-test-scripts.png']:
            with self.subTest(name=name):
                direct = urlopen(self.origin + '/' + name).read()
                nested = urlopen(self.origin + '/portfolio/' + name + '?v=32').read()
                self.assertEqual(direct, nested)

    def test_unimplemented_routes_and_private_files_remain_unavailable(self):
        for path in ['/portfolio/foome', '/portfolio/edbost', '/evidence.json', '/server/app.py', '/config/routes.json', '/%2e%2e/serve_portfolio.py']:
            with self.subTest(path=path), self.assertRaises(HTTPError) as result:
                urlopen(self.origin + path)
            self.assertEqual(result.exception.code, 404)
            result.exception.close()


if __name__ == '__main__':
    unittest.main()
