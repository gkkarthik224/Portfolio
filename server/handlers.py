"""Reusable HTTP handler with the portfolio's existing cache policy."""
from http.server import SimpleHTTPRequestHandler


class PortfolioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, router, **kwargs):
        self.router = router
        super().__init__(*args, directory=str(router.root), **kwargs)

    def _redirect_legacy_page(self):
        target = self.router.redirect_target(self.path)
        if not target:
            return False
        self.send_response(302)
        self.send_header('Location', target)
        self.send_header('Content-Length', '0')
        self.end_headers()
        return True

    def do_GET(self):
        if not self._redirect_legacy_page():
            super().do_GET()

    def do_HEAD(self):
        if not self._redirect_legacy_page():
            super().do_HEAD()

    def translate_path(self, path):
        target = self.router.resolve(path)
        return str(target or self.router.root / '__not_found__')

    def list_directory(self, path):
        self.send_error(404, 'Not found')
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
