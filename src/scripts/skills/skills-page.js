// Shared glass menu. Page exits are coordinated by page-transitions.js.
(() => {
  const items = [
    {label: 'Home', href: '/'},
    {label: 'Projects', href: '/portfolio'},
    {label: 'Skills', href: '/skills'},
    {label: 'Contact', href: '/contact'},
    {label: 'About', href: '/about'}
  ];
  const aliases = {'/home-settled.html': '/', '/about-loaded.html': '/about',
    '/portfolio-loaded.html': '/portfolio', '/contact-loaded.html': '/contact',
    '/skills.html': '/skills', '/project-loaded.html': '/portfolio'};
  const normalize = value => {
    const path = new URL(value, location.href).pathname.replace(/\/$/, '') || '/';
    return aliases[path] || (path.startsWith('/portfolio/') ? '/portfolio' : path);
  };
  function start() {
    const current = normalize(location.href);
    if (current === "/") return;
    if (document.querySelector('.cell-top-menu')) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    document.body.classList.add('has-cell-menu');
    const nav = document.createElement('nav');
    nav.className = 'cell-top-menu';
    nav.setAttribute('aria-label', 'Page menu');
    const cell = document.createElement('span');
    cell.className = 'cell-menu-cell';
    cell.setAttribute('aria-hidden', 'true');
    nav.appendChild(cell);
    const links = new Map();
    for (const item of items) {
      const link = document.createElement('a');
      link.href = item.href; link.textContent = item.label;
      if (item.href === current) link.setAttribute('aria-current', 'page');
      nav.appendChild(link);
      links.set(item.href, link);
    }
    document.body.appendChild(nav);
    let selected = links.get(current);
    let preview = selected;
    function place(link, center = false) {
      if (!link) return;
      preview = link;
      nav.style.setProperty('--cell-x', `${link.offsetLeft}px`);
      nav.style.setProperty('--cell-y', `${link.offsetTop}px`);
      nav.style.setProperty('--cell-width', `${link.offsetWidth}px`);
      nav.style.setProperty('--cell-height', `${link.offsetHeight}px`);
      for (const entry of links.values()) entry.toggleAttribute('data-cell-selected', entry === link);
      if (center) {
        // Scroll only the small menu on mobile; never shift the page underneath it.
        const maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth);
        const left = Math.min(maxScroll, Math.max(0, link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2));
        if (nav.hasAttribute('data-cell-ready')) {
          nav.scrollTo({left, behavior: reduced.matches ? 'auto' : 'smooth'});
        } else {
          nav.scrollLeft = left;
        }
      }
    }
    const eventLink = event => event.target instanceof Element && event.target.closest('.cell-top-menu a');
    nav.addEventListener('pointerover', event => {
      if (event.pointerType !== 'touch') place(eventLink(event));
    });
    nav.addEventListener('pointerleave', () => {
      place(nav.contains(document.activeElement) ? document.activeElement.closest('a') || selected : selected);
    });
    nav.addEventListener('focusin', event => place(eventLink(event), true));
    nav.addEventListener('focusout', event => { if (!nav.contains(event.relatedTarget)) place(selected); });
    function reset() {
      selected = links.get(normalize(location.href));
      place(selected, true);
    }
    window.PortfolioMenu = {
      select(path) {
        const next = links.get(normalize(path));
        if (!next) return 0;
        const changed = selected !== next;
        selected = next;
        place(next, true);
        return reduced.matches ? 0 : changed ? 420 : 180;
      }
    };
    const resize = new ResizeObserver(() => place(preview, preview === selected));
    resize.observe(nav);
    for (const link of links.values()) resize.observe(link);
    window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
    reduced.addEventListener('change', () => place(selected));
    place(selected, true);
    requestAnimationFrame(() => {
      place(selected, true);
      nav.setAttribute('data-cell-ready', '');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
