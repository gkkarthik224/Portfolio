"""Isolated QA server using the application's real routing and HTTP handler."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

from server.handlers import PortfolioHandler
from server.routing import SiteRouter


class QAHandler(PortfolioHandler):
    def log_message(self, format, *args):
        # Browser/network diagnostics are retained by Playwright, without noisy
        # per-asset console output. Exceptions still go to stderr.
        pass


class QAServer(ThreadingHTTPServer):
    # Chromium fetches many skill icons simultaneously. The default small TCP
    # backlog can refuse valid requests on Windows during parallel test runs.
    request_queue_size = 128
    allow_reuse_address = True


def main():
    root = Path(__file__).resolve().parents[1]
    handler = partial(QAHandler, router=SiteRouter(root))
    with QAServer(('127.0.0.1', 8765), handler) as server:
        print('Portfolio QA server listening on 127.0.0.1:8765', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
