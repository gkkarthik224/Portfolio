// One motion lifecycle for direct loads, navigation, scrolling and history restores.
(() => {
  if (window.PortfolioMotion) return;
  const root = document.documentElement;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.22,1,.36,1)';
  const started = performance.now();
  const active = new Set();
  const seen = new WeakSet();
  const pending = new Set();
  let ready = false, leaving = false, exitTimer, observer, loader;
  let scroller, frame;
  function stopScrolling() {
    cancelAnimationFrame(frame);
    frame = undefined;
    scroller?.destroy();
    scroller = undefined;
  }
  function startScrolling() {
    if (scroller || preference.matches || !window.PortfolioSmoothScroll) return;
    scroller = new window.PortfolioSmoothScroll({
      lerp: 0.075,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      prevent: node => node.matches?.('textarea, select, [contenteditable="true"], .cell-top-menu')
    });
    const tick = time => {
      scroller?.raf(time);
      if (scroller && !document.hidden) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  let returning = false;
  try {
    returning = sessionStorage.getItem('portfolio-navigation') === '1';
    sessionStorage.removeItem('portfolio-navigation');
    sessionStorage.removeItem('portfolio-return-animation');
  } catch {}
  root.setAttribute('data-page-loading', '');

  function animate(element, frames, options) {
    if (preference.matches || !element.animate) return;
    const animation = element.animate(frames, {easing: ease, ...options});
    active.add(animation);
    animation.finished.catch(() => {}).finally(() => active.delete(animation));
    return animation;
  }
  function reveal(element, delay = 0) {
    pending.delete(element);
    observer?.unobserve(element);
    element.removeAttribute('data-motion-pending');
    animate(element, [{opacity: 0, translate: '0 24px'}, {opacity: 1, translate: '0 0'}], {duration: 700, delay, fill: 'backwards'});
  }
  function collect() {
    // Container entrances preserve the interactive Framer child transforms.
    const elements = document.querySelectorAll([
      'main > [data-framer-name="Title"]',
      'main > section:not([data-framer-name="Ticker"], .skills-list, .portfolio-projects, [data-scroll-text-section])',
      'main [data-framer-name="Title + Cards"] > section:not(.portfolio-projects)',
      'main [data-framer-name="Content"] > section:not([data-framer-name="Ticker"], .portfolio-projects)',
      '.framer-TlDBu .framer-1f9w7vf', '.framer-TlDBu .framer-1nw48ne',
      '.skills-intro:not(:has(.skills-text-word))', '.skills-footer'
    ].join(','));
    for (const element of elements) {
      if (seen.has(element) || !element.getClientRects().length) continue;
      seen.add(element);
      const bounds = element.getBoundingClientRect();
      if (bounds.bottom <= 0) continue;
      if (bounds.top < innerHeight) {
        // Hydration must not replay an already visible entrance.
        if (!ready) pending.add(element);
      } else if (observer && !preference.matches) {
        element.setAttribute('data-motion-pending', '');
        pending.add(element);
        observer.observe(element);
      }
    }
    if (!ready) return;
    let index = 0;
    for (const element of pending) {
      if (!element.isConnected) { pending.delete(element); continue; }
      if (element.getBoundingClientRect().top < innerHeight) reveal(element, Math.min(index++ * 65, 195));
    }
  }
  function finish() {
    if (ready || !document.body) return;
    clearTimeout(failsafe);
    collect();
    ready = true;
    root.removeAttribute('data-page-loading');
    root.setAttribute('data-page-ready', '');
    loader?.setAttribute('aria-hidden', 'true');
    startScrolling();
    let index = 0;
    for (const element of pending) {
      if (element.getBoundingClientRect().top < innerHeight) reveal(element, Math.min(index++ * 65, 195));
    }
    window.dispatchEvent(new Event('portfolio-ready'));
  }
  // Third-party resources must never trap the page behind a loader.
  const failsafe = setTimeout(finish, 2400);
  function start() {
    loader = document.getElementById('portfolio-loader');
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (!ready) return;
        let index = 0;
        for (const entry of entries) if (entry.isIntersecting) reveal(entry.target, Math.min(index++ * 65, 195));
      }, {threshold: 0, rootMargin: '0px 0px -24px 0px'});
    }
    // Deferred menu setup reserves space before we measure the first screen.
    requestAnimationFrame(() => {
      const images = [...document.images].filter(image => image.getBoundingClientRect().top < innerHeight);
      const assets = [document.fonts?.ready, ...images.map(image => image.decode?.().catch(() => {}))];
      Promise.race([
        Promise.allSettled(assets),
        new Promise(resolve => setTimeout(resolve, 1400))
      ]).then(() => setTimeout(finish, Math.max(0, (returning ? 100 : 420) - (performance.now() - started))));
    });
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled || !ready) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; collect(); });
    }).observe(document.body, {childList: true, subtree: true});
  }
  const routes = new Set(['/', '/about', '/portfolio', '/contact', '/skills', '/skills.html',
    '/portfolio/travel-easy', '/portfolio/script-change-management', '/portfolio/procurement-erp',
    '/portfolio/defect-management', '/home-settled.html', '/about-loaded.html',
    '/portfolio-loaded.html', '/contact-loaded.html', '/project-loaded.html']);
  window.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element && event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash && scroller) {
      let target;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch {}
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      scroller.scrollTo(target, {offset: -parseFloat(getComputedStyle(root).scrollPaddingTop || 0)});
      history.pushState(null, '', url.hash);
      target.focus({preventScroll: true});
      return;
    }
    if (url.origin !== location.origin || !routes.has(url.pathname) || url.hash || url.href === location.href) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (leaving) return;
    leaving = true;
    const menuDuration = window.PortfolioMenu?.select(url.pathname) || 0;
    try { sessionStorage.setItem('portfolio-navigation', '1'); } catch {}
    if (preference.matches) { location.assign(url.href); return; }
    root.setAttribute('data-page-leaving', '');
    // Fade only: moving the entire page would rebase fixed navigation and glass.
    animate(document.querySelector('main') || document.body, [{opacity: 1}, {opacity: 0}], {duration: 180, fill: 'forwards'});
    exitTimer = setTimeout(() => location.assign(url.href), Math.max(180, menuDuration));
  }, true);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    clearTimeout(exitTimer);
    active.forEach(animation => animation.cancel());
    leaving = false;
    root.removeAttribute('data-page-leaving');
    finish();
    root.removeAttribute('data-page-loading');
    startScrolling();
    collect();
  });
  window.addEventListener('pagehide', stopScrolling);
  document.addEventListener('visibilitychange', () => {
    stopScrolling();
    if (!document.hidden && ready) startScrolling();
  });
  preference.addEventListener('change', () => {
    if (!preference.matches) { if (ready) startScrolling(); return; }
    stopScrolling();
    active.forEach(animation => animation.cancel());
    for (const element of pending) reveal(element);
    finish();
  });
  window.PortfolioMotion = {get ready() { return ready; }};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
