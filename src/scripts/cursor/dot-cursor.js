(() => {
  function start() {
    if (document.getElementById('portfolio-dot-cursor')) return;
    const dot = document.createElement('div');
    dot.id = 'portfolio-dot-cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    const hide = () => document.documentElement.removeAttribute('data-dot-cursor');
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') { hide(); return; }
      dot.style.transform = `translate3d(${event.clientX - 4}px, ${event.clientY - 4}px, 0)`;
      if (!document.documentElement.hasAttribute('data-dot-cursor')) {
        document.documentElement.setAttribute('data-dot-cursor', 'active');
      }
    }, {passive: true});
    document.addEventListener('pointerout', event => {
      if (!event.relatedTarget) hide();
    }, {passive: true});
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse') hide();
    }, {passive: true});
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hide();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
