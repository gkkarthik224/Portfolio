(() => {
  function start() {
    if (document.getElementById('portfolio-dot-cursor')) return;
    const dot = document.createElement('div');
    dot.id = 'portfolio-dot-cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let x = 0, y = 0, targetX = 0, targetY = 0;
    let frame, lastTime, tracking = false;
    function paint(time) {
      frame = undefined;
      const elapsed = lastTime === undefined ? 1000 / 60 : Math.min(50, time - lastTime);
      lastTime = time;
      const blend = reduced.matches ? 1 : 1 - Math.exp(-elapsed / 45);
      x += (targetX - x) * blend;
      y += (targetY - y) * blend;
      const moving = Math.abs(targetX - x) > .1 || Math.abs(targetY - y) > .1;
      if (!moving) { x = targetX; y = targetY; lastTime = undefined; }
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (moving) frame = requestAnimationFrame(paint);
    }
    const hide = () => {
      cancelAnimationFrame(frame);
      frame = lastTime = undefined;
      tracking = false;
      document.documentElement.removeAttribute('data-dot-cursor');
    };
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') { hide(); return; }
      targetX = event.clientX - 4;
      targetY = event.clientY - 4;
      if (!tracking) {
        x = targetX; y = targetY;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        tracking = true;
        document.documentElement.setAttribute('data-dot-cursor', 'active');
      }
      if (frame === undefined) frame = requestAnimationFrame(paint);
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
