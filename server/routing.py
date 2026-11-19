"""Resolve public URLs through an explicit, validated file manifest."""
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit


class SiteRouter:
    def __init__(self, root: Path):
        self.root = root.resolve()
        manifest = json.loads((self.root / 'config' / 'routes.json').read_text(encoding='utf-8'))
        self.redirects = manifest.get('redirects', {})
        self.routes = manifest['routes']
        self.files = manifest['files']
        for relative in self.files.values():
            target = (self.root / relative).resolve()
            if not target.is_relative_to(self.root) or not target.is_file():
                raise ValueError(f'Invalid manifest target: {relative}')

    def redirect_target(self, url: str) -> str | None:
        route = unquote(urlsplit(url).path).rstrip('/') or '/'
        if route.startswith('/portfolio/') and route not in self.redirects:
            legacy = '/' + route[len('/portfolio/'):]
            if legacy in self.redirects:
                route = legacy
        return self.redirects.get(route)

    def resolve(self, url: str) -> Path | None:
        redirect = self.redirect_target(url)
        if redirect:
            return self.resolve(redirect)
        requested = unquote(urlsplit(url).path)
        route = requested.rstrip('/') or '/'
        public_file = self.routes.get(route, requested.lstrip('/'))
        # Preserve the original detail-page asset URLs and relative links.
        if public_file.startswith('portfolio/'):
            public_file = public_file[len('portfolio/'):]
        relative = self.files.get(public_file)
        return (self.root / relative) if relative else None
