// Shared Vexoo text reveal: scroll between 60% and 30% of the viewport.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (window.PortfolioScrollText) return;
  const blocks = new Map();
  const ownedSelector = [
    '.about-bio', '.about-experience > p',
    '.skills-main p:not(.page-label)', '.skills-proof h2', '.skills-proof h3',
    '.skill-row h2', '.skill-tags li > span',
    '.case-main h2', '.case-main h3', '.case-main p:not(.case-index):not(.case-eyebrow)',
    '.contact-details-intro', '.email-draft-note', '.home-specialization p'
  ].join(',');
  const titleSelector = '#about-title, .case-hero h1';
  const nativeSelector = '.framer-TlDBu h1, main [data-framer-name="Title"] h1, .skills-intro h1';
  const selector = [ownedSelector, titleSelector, nativeSelector].join(',');
  const entered = new WeakSet();
  const resize = new ResizeObserver(schedule);
  let collectFrame;
  let settleUntil = 0;
  const titleAnimations = [];
  let frame;
  const clamp = value => Math.max(0, Math.min(1, value));

  function split(element, title = false) {
    const text = element.textContent;
    const accessible = document.createElement('span');
    accessible.className = 'scroll-text-accessible';
    accessible.textContent = text;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.className = 'scroll-text-visual';
    const words = text.match(/\S+/g) || [];
    const characters = [];
    let wordIndex = 0;
    for (const token of text.split(/(\s+)/)) {
      if (!token || /^\s+$/.test(token)) {
        visual.append(token);
        continue;
      }
      const word = document.createElement('span');
      word.className = 'scroll-text-word';
      const letters = Array.from(token);
      letters.forEach((letter, index) => {
        const character = document.createElement('span');
        character.className = title ? 'scroll-title-character' : 'scroll-text-character';
        character.textContent = letter;
        const start = (wordIndex + index / letters.length) / (words.length + 1);
        const end = (wordIndex + (index + 1) / letters.length) / (words.length + 1);
        characters.push({element: character, start, end});
        word.appendChild(character);
      });
      visual.appendChild(word);
      wordIndex++;
    }
    if (title || /^H[1-6]$/.test(element.tagName)) {
      element.setAttribute('aria-label', text);
      element.replaceChildren(visual);
    } else element.replaceChildren(accessible, visual);
    return {element, characters};
  }

  function paint() {
    frame = undefined;
    const viewport = document.documentElement.clientHeight;
    const limit = Math.max(0, document.documentElement.scrollHeight - viewport);
    const scroll = scrollY;
    const measurements = [];
    for (const block of blocks.values()) {
      if (!block.element.isConnected) {
        blocks.delete(block.element);
        resize.unobserve(block.element);
        continue;
      }
      if (block.title) continue;
      const bounds = block.element.getBoundingClientRect();
      const top = bounds.top + scroll;
      // Short pages must also finish their final paragraphs
      // at the page bottom even when they cannot reach the 30% viewport line.
      const end = Math.min(limit, top + bounds.height - viewport * .3);
      const start = Math.min(top - viewport * .6, end - 1);
      const progress = clamp((scroll - start) / (end - start));
      if (block.progress === progress && block.reduced === reduced.matches) continue;
      measurements.push({block, progress});
    }
    // Read all geometry before changing styles, and leave settled text alone.
    for (const {block, progress} of measurements) {
      block.progress = progress;
      block.reduced = reduced.matches;
      for (const character of block.characters) {
        const opacity = reduced.matches ? 1 : .2 + .8 * clamp((progress - character.start) / (character.end - character.start));
        if (character.opacity === opacity) continue;
        character.opacity = opacity;
        if (block.native) {
          // Preserve Framer's own opacity/transform animation and its DOM nodes.
          // A uniform alpha mask composes the scroll opacity with that entrance.
          character.element.style.maskImage = opacity > .999 ? 'none' : `linear-gradient(rgb(0 0 0 / ${opacity}), rgb(0 0 0 / ${opacity}))`;
          character.element.style.setProperty('--scroll-text-opacity', String(opacity));
        } else character.element.style.opacity = String(opacity);
      }
    }
    if (performance.now() < settleUntil && !document.hidden) schedule();
  }
  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(paint);
  }
  function enter(heading) {
    if (!heading || entered.has(heading.element) || !root.hasAttribute('data-page-ready')) return;
    entered.add(heading.element);
    if (reduced.matches) return;
    const spring = 'linear(0, .21287, .42347, .57824, .69147, .77430, .83489, .87922, .91164, .93536, .95272, .96541, .97470, .98149, .98646, .99009, .99275, .99470, .99612, .99716, .99792, .99848, .99889, .99919, 1)';
    heading.characters.forEach(({element}, index) => {
      const animation = element.animate([
        {opacity: .001, transform: 'translateY(150px) skewY(4deg)'},
        {opacity: 1, transform: 'translateY(0) skewY(0)'}
      ], {duration: 1400, delay: 400 + Math.min(index * 30, 750), easing: spring, fill: 'backwards'});
      titleAnimations.push(animation);
    });
  }
  function collect() {
    collectFrame = undefined;
    for (const element of document.querySelectorAll(selector)) {
      const previous = blocks.get(element);
      const native = element.matches(nativeSelector);
      if (previous && !native) continue;
      let block;
      if (native) {
        const units = [...element.querySelectorAll('span')].filter(span => !span.childElementCount && span.textContent.trim());
        if (!units.length || previous?.characters.every((character, index) => character.element === units[index]) && previous.characters.length === units.length) continue;
        block = {element, native: true, characters: units.map((unit, index) => ({element: unit, start: index / (units.length + 1), end: (index + 1) / (units.length + 1)}))};
      } else {
        // These are our semantic content nodes. Leave rich text and controls intact.
        if (element.childElementCount || !element.textContent.trim()) continue;
        block = split(element, element.matches(titleSelector));
        block.title = element.matches(titleSelector);
      }
      element.setAttribute('data-scroll-text', '');
      blocks.set(element, block);
      resize.observe(element);
      if (block.title) enter(block);
    }
    schedule();
  }
  function requestCollect() {
    if (collectFrame === undefined) collectFrame = requestAnimationFrame(collect);
  }
  function start() {
    window.PortfolioScrollText = {get count() { return blocks.size; }};
    collect();
    const ready = () => {
      settleUntil = performance.now() + 2600;
      collect();
      for (const block of blocks.values()) if (block.title) enter(block);
      schedule();
    };
    if (root.hasAttribute('data-page-ready')) ready();
    else window.addEventListener('portfolio-ready', ready, {once: true});
    new MutationObserver(records => {
      // Ignore the spans we create, and watch for hydrated headings and newly mounted text.
      if (records.some(record => record.target instanceof Element && record.target.closest(nativeSelector)
        || [...record.addedNodes].some(node => node instanceof Element && (node.matches(selector) || node.querySelector(selector))))) requestCollect();
    }).observe(document.body, {childList: true, subtree: true});
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    window.addEventListener('pageshow', requestCollect);
    document.fonts?.ready.then(schedule);
    reduced.addEventListener('change', () => {
      if (reduced.matches) titleAnimations.forEach(animation => animation.cancel());
      schedule();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
