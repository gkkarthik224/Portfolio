import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scripts/navigation/page-transitions.js', import.meta.url), 'utf8');

function page({reducedMotion = false, pathname = '/portfolio/'} = {}) {
  const listeners = {window: new Map(), document: new Map()};
  const timers = new Map(), animations = [], navigations = [];
  let timerId = 0;
  const on = target => (type, listener) => {
    const entries = listeners[target].get(type) ?? [];
    entries.push(listener);
    listeners[target].set(type, entries);
  };
  const emit = (target, type, event = {}) => {
    for (const listener of listeners[target].get(type) ?? []) listener(event);
  };
  class Element {
    attributes = new Map();
    style = {};
    opacity = 1;
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    closest() { return this; }
    animate(frames, options) {
      let resolve, reject;
      const animation = {
        playState: 'running',
        finished: new Promise((done, fail) => { resolve = done; reject = fail; }),
        finish: () => {
          animation.playState = 'finished';
          if (options.fill === 'forwards') this.opacity = frames.at(-1).opacity;
          resolve();
        },
        cancel: () => {
          animation.playState = 'idle';
          this.opacity = 1;
          reject(new Error('Animation cancelled'));
        }
      };
      animations.push(animation);
      return animation;
    }
  }
  const root = new Element(), main = new Element(), body = new Element();
  const location = {
    origin: 'https://portfolio.invalid', pathname,
    href: `https://portfolio.invalid${pathname}`, assign: url => navigations.push(url)
  };
  const window = {addEventListener: on('window'), dispatchEvent: event => emit('window', event.type, event)};
  const document = {
    documentElement: root, body, hidden: false, readyState: 'loading',
    addEventListener: on('document'), querySelectorAll: () => [], querySelector: () => main
  };
  vm.runInNewContext(source, {
    window, document, location, Element, URL, Event,
    matchMedia: () => ({matches: reducedMotion, addEventListener() {}}),
    sessionStorage: {getItem() {}, removeItem() {}, setItem() {}},
    performance: {now: () => 0}, innerHeight: 800,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, {callback, delay}); return id; },
    clearTimeout: id => timers.delete(id), cancelAnimationFrame() {}
  });
  const advance = milliseconds => {
    for (const [id, timer] of [...timers]) {
      if (timer.delay <= milliseconds && timers.delete(id)) timer.callback();
    }
  };
  advance(2400);
  const click = (href = 'https://portfolio.invalid/about') => {
    const link = new Element();
    link.href = href;
    emit('window', 'click', {target: link, button: 0, preventDefault() {}, stopImmediatePropagation() {}});
  };
  const leave = async () => {
    click();
    animations.at(-1)?.finish();
    // Allow the production finished.catch().finally() to remove the animation
    // from its running-animation set before the page is cached.
    await setImmediate();
    advance(180);
  };
  return {root, main, window, animations, navigations, advance, click, leave,
    hide: () => emit('window', 'pagehide', {persisted: true}),
    show: persisted => emit('window', 'pageshow', {persisted})};
}

test('pagehide removes a completed exit fade before the history snapshot', async () => {
  const view = page();
  await view.leave();
  assert.equal(view.main.opacity, 0, 'The exit fade must actually have completed');
  view.hide();
  assert.equal(view.main.opacity, 1, 'A cached page must not retain the invisible exit frame');
  assert.equal(view.root.hasAttribute('data-page-leaving'), false);
});

test('directory routes and cross-page fragments use document navigation', () => {
  for (const path of ['/about/', '/about/#experience', '/portfolio/', '/skills/?from=menu']) {
    const view = page({pathname: '/'});
    const href = `https://portfolio.invalid${path}`;
    view.click(href);
    view.advance(180);
    assert.deepEqual(view.navigations, [href], path);
  }
});

test('same-page fragments retain native anchor navigation', () => {
  const view = page();
  view.click('https://portfolio.invalid/portfolio/#portfolio-projects');
  view.advance(180);
  assert.equal(view.navigations.length, 0);
});

test('Back restores visibility even after the finished animation left the active set', async () => {
  const view = page();
  await view.leave();
  view.show(true);
  assert.equal(view.main.opacity, 1);
  assert.equal(view.root.hasAttribute('data-page-loading'), false);
  assert.equal(view.window.PortfolioMotion.ready, true);
});

test('a history restore cancels an interrupted navigation timer', () => {
  const view = page();
  view.click();
  view.show(true);
  view.advance(180);
  assert.equal(view.navigations.length, 0);
  assert.equal(view.main.opacity, 1);
});

test('repeated Back and Forward restores permit another navigation', async () => {
  const view = page();
  for (let cycle = 0; cycle < 3; cycle++) {
    await view.leave();
    view.hide();
    view.show(true);
    assert.equal(view.main.opacity, 1);
    assert.equal(view.navigations.length, cycle + 1);
  }
});

test('reduced motion restores without creating a fade', async () => {
  const view = page({reducedMotion: true});
  await view.leave();
  view.hide();
  view.show(true);
  assert.equal(view.main.opacity, 1);
  assert.equal(view.animations.length, 0);
  assert.equal(view.navigations.length, 1);
});
