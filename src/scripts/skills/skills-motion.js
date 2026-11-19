// Reveal each row's text once, after the shared page entrance has finished.
(() => {
  if (!document.body.classList.contains('skills-page')) return;
  const rows = [...document.querySelectorAll('.skills-list .skill-row')];
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let observer;

  function reveal(row) {
    row.removeAttribute('data-skill-pending');
    row.setAttribute('data-skill-revealed', '');
    observer?.unobserve(row);
  }

  function showAll() {
    observer?.disconnect();
    rows.forEach(reveal);
  }

  if (preference.matches || !('IntersectionObserver' in window)) {
    showAll();
    return;
  }

  rows.forEach(row => row.setAttribute('data-skill-pending', ''));
  function start() {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
    }, {threshold: 0.15, rootMargin: '0px 0px -16px 0px'});
    rows.forEach(row => observer.observe(row));
  }

  if (window.PortfolioMotion?.ready) start();
  else {
    // Content stays readable even if another page script does not finish.
    const fallback = setTimeout(showAll, 3500);
    window.addEventListener('portfolio-ready', () => {
      clearTimeout(fallback);
      start();
    }, {once: true});
  }
  preference.addEventListener('change', event => { if (event.matches) showAll(); });
  window.addEventListener('pageshow', event => { if (event.persisted) showAll(); });
})();
