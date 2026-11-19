import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scripts/navigation/page-transitions.js', import.meta.url), 'utf8');
const scrollSource = await readFile(new URL('../src/scripts/navigation/smooth-scroll.js', import.meta.url), 'utf8');
function harness({reduced = false, blocked = false} = {}) {
  const timers = new Map(), frames = new Map(), handlers = new Map();
  let clock = 0, sequence = 0, scrollers = 0, destroyed = 0, mutations;
  class Element {
    attributes = new Map(); animations = []; isConnected = true; className = '';
    scrollTop = 0; scrollLeft = 0; scrollHeight = 3200; scrollWidth = 1440;
    clientWidth = 1440; clientHeight = 900;
    constructor(top = 0) { this.top = top; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    hasAttribute(key) { return this.attributes.has(key); }
    getClientRects() { return [this.getBoundingClientRect()]; }
    getBoundingClientRect() { return {top: this.top, bottom: this.top + 200}; }
    animate(keyframes, options) {
      const animation = {keyframes, options, cancelled: false, finished: new Promise(() => {}), cancel() { this.cancelled = true; }};
      this.animations.push(animation); return animation;
    }
    closest() { return this; }
    matches() { return false; }
  }
  const root = new Element(), main = new Element(), hero = new Element(100), card = new Element(1200), loader = new Element();
  const elements = [hero, card];
  const addEventListener = (type, handler) => { const list = handlers.get(type) || []; list.push(handler); handlers.set(type, list); };
  const emit = (type, event = {}) => { for (const handler of handlers.get(type) || []) handler(event); };
  const preference = {matches: reduced, addEventListener: (_, handler) => { preference.change = handler; }};
  const location = {origin: 'http://localhost:8080', pathname: '/', href: 'http://localhost:8080/', assigned: [], assign(url) { this.assigned.push(url); }};
  const storage = new Map();
  const context = {
    Element, URL, Event, console, Promise, Map, Set, WeakSet,
    performance: {now: () => clock}, innerHeight: 900, innerWidth: 1440,
    location, matchMedia: () => preference,
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, {fn, time: clock + delay}); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    addEventListener, removeEventListener() {}, dispatchEvent: event => emit(event.type, event),
    ResizeObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { constructor(fn) { mutations = fn; } observe() {} },
    IntersectionObserver: class { constructor(fn) { context.intersection = fn; } observe() {} unobserve() {} },
    PortfolioSmoothScroll: class { constructor() { scrollers++; } raf() {} destroy() { destroyed++; } },
    document: {
      documentElement: root, body: main, readyState: 'loading', images: [], hidden: false,
      fonts: {ready: blocked ? new Promise(() => {}) : Promise.resolve()},
      addEventListener, querySelectorAll: () => elements,
      querySelector: () => main, getElementById: () => loader
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
  async function advance(ms) {
    const end = clock + ms;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.time <= end).sort((a, b) => a[1].time - b[1].time)[0];
      if (!next) break;
      clock = next[1].time; timers.delete(next[0]); next[1].fn(); await flush();
    }
    clock = end; await flush();
  }
  async function start() {
    emit('DOMContentLoaded');
    const initial = [...frames]; frames.clear();
    initial.forEach(([, fn]) => fn(clock)); await flush();
  }
  function click(href, extra = {}) {
    const target = new Element(); target.href = href;
    const event = {target, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {}, ...extra};
    emit('click', event); return event;
  }
  return {context, root, main, hero, card, elements, emit, click, start, advance, mutations: () => mutations(), preference,
    counts: () => ({scrollers, destroyed}), scrollSource};
}

const normal = harness();
await normal.start(); await normal.advance(420);
assert.equal(normal.context.PortfolioMotion.ready, true);
assert.equal(normal.root.hasAttribute('data-page-loading'), false);
assert.equal(normal.hero.animations.length, 1);
assert.equal(normal.hero.animations[0].options.fill, 'backwards', 'staggered entrances must not flash before their delay');
assert.equal(normal.card.hasAttribute('data-motion-pending'), true);
normal.context.intersection([{target: normal.card, isIntersecting: true}]);
assert.equal(normal.card.animations.length, 1);
assert.equal(normal.card.hasAttribute('data-motion-pending'), false);
normal.mutations();
assert.equal(normal.hero.animations.length, 1, 'hydration must not replay a visible entrance');
for (const extra of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}]) {
  assert.equal(normal.click('http://localhost:8080/about', extra).defaultPrevented, false);
}
assert.equal(normal.click('https://example.com/').defaultPrevented, false);
normal.click('http://localhost:8080/about'); normal.click('http://localhost:8080/contact');
await normal.advance(180);
assert.deepEqual(normal.context.location.assigned, ['http://localhost:8080/about'], 'rapid clicks must navigate only once');
normal.emit('pagehide'); normal.emit('pageshow', {persisted: true});
assert.equal(normal.root.hasAttribute('data-page-leaving'), false);
assert.equal(normal.main.animations.at(-1).cancelled, true, 'back navigation must not restore an invisible page');
assert.deepEqual(normal.counts(), {scrollers: 2, destroyed: 1});
normal.preference.matches = true; normal.preference.change();
assert.equal(normal.counts().destroyed, 2);

const reduced = harness({reduced: true});
await reduced.start(); await reduced.advance(420);
assert.equal(reduced.hero.animations.length, 0);
assert.equal(reduced.counts().scrollers, 0);
assert.equal(reduced.card.hasAttribute('data-motion-pending'), false);
reduced.click('http://localhost:8080/skills');
assert.equal(reduced.context.location.assigned.length, 1, 'reduced-motion navigation is immediate');

const blocked = harness({blocked: true});
const menuNavigation = harness();
menuNavigation.context.PortfolioMenu = {select: () => 420};
await menuNavigation.start(); await menuNavigation.advance(420);
menuNavigation.click('http://localhost:8080/contact');
await menuNavigation.advance(180);
assert.equal(menuNavigation.context.location.assigned.length, 0, 'let the glass cell finish sliding before navigation');
await menuNavigation.advance(240);
assert.equal(menuNavigation.context.location.assigned.length, 1);
await blocked.start(); await blocked.advance(1500);
assert.equal(blocked.context.PortfolioMotion.ready, true, 'blocked fonts cannot trap the loader');
const failsafe = harness({blocked: true});
await failsafe.advance(2400);
assert.equal(failsafe.context.PortfolioMotion.ready, true, 'the loader also recovers without DOMContentLoaded');

// Exercise the actual bundled scroll implementation, including history position.
vm.runInContext(scrollSource, normal.context);
normal.root.scrollTop = 300;
const scroller = new normal.context.PortfolioSmoothScroll({duration: 1, autoResize: false});
assert.equal(scroller.scroll, 300, 'initializing must preserve the restored scroll position');
scroller.scrollTo(900); scroller.raf(1); scroller.raf(501); scroller.raf(1001);
assert.equal(normal.root.scrollTop, 900);
scroller.destroy();
console.log('Passed: loading, asset timeout, reveals, navigation, history, reduced motion, and original smooth scrolling.');
