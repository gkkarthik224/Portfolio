"""Application entry point: python -m server.app --port 8080."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

from .handlers import PortfolioHandler
from .routing import SiteRouter

ROOT = Path(__file__).resolve().parents[1]


def create_server(host='0.0.0.0', port=8080, root=ROOT):
    router = SiteRouter(root)
    handler = partial(PortfolioHandler, router=router)
    return ThreadingHTTPServer((host, port), handler)


def main():
    parser = argparse.ArgumentParser(description='Serve the local portfolio')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()
    with create_server(args.host, args.port) as server:
        print(f'Portfolio listening on {args.host}:{args.port}', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
