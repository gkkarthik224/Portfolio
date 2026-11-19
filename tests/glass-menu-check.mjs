import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scripts/skills/skills-page.js', import.meta.url), 'utf8');
function create(path) {
  let nav, resize;
  const events = new Map();
  class Element {
    children = []; attributes = new Map(); events = new Map(); properties = new Map();
    style = {setProperty: (key, value) => this.properties.set(key, value)};
    classList = {add() {}};
    offsetLeft = 0; offsetTop = 6; offsetWidth = 70; offsetHeight = 40; clientWidth = 358;
    constructor(tag) { this.tag = tag; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    toggleAttribute(key, on) { if (on) this.attributes.set(key, ''); else this.attributes.delete(key); }
    hasAttribute(key) { return this.attributes.has(key); }
    appendChild(child) { child.parent = this; child.offsetLeft = 6 + this.children.filter(el => el.tag === 'a').length * 76; this.children.push(child); }
    prepend(child) { child.parent = this; this.children.unshift(child); }
    addEventListener(type, fn) { this.events.set(type, fn); }
    scrollTo(options) { this.scroll = options; }
    contains(element) { return element === this || this.children.includes(element); }
    closest() { return this.tag === 'a' ? this : null; }
  }
  const reduced = {matches: false, addEventListener(_, fn) { this.change = fn; }};
  const context = {
    URL, Element, location: {href: 'http://localhost:8080' + path},
    matchMedia: () => reduced, requestAnimationFrame: fn => fn(),
    ResizeObserver: class {constructor(fn) { resize = fn; } observe() {}},
    document: {
      readyState: 'complete', body: new Element('body'),
      createElement: tag => new Element(tag), querySelector: () => nav,
      activeElement: null
    },
    addEventListener: (name, fn) => events.set(name, fn)
  };
  context.document.body.appendChild = element => { nav = element; };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return {context, get nav() { return nav; }, reduced, events, resize: () => resize()};
}
for (const path of ['/', '/home-settled.html', '/about', '/portfolio', '/contact', '/skills', '/skills.html', '/portfolio/travel-easy']) {
  const page = create(path);
  if (path === '/' || path === '/home-settled.html') { assert.equal(page.nav, undefined, 'Home has no floating menu'); continue; }
  const links = page.nav.children.filter(el => el.tag === 'a');
  assert.equal(page.context.document.body.children.some(el => el.className === 'portfolio-context-bar'), false);
  assert.deepEqual(links.map(link => link.textContent), ['Home', 'Projects', 'Skills', 'Contact', 'Resume', 'About']);
  assert.equal(page.nav.children.filter(el => el.className === 'cell-menu-cell').length, 1);
  assert.equal(links.filter(el => el.attributes.get('aria-current') === 'page').length, 1);
  assert.equal(links.find(link => link.attributes.get('aria-current') === 'page').textContent, path === '/' ? 'Home' : path.includes('portfolio') ? 'Projects' : path === '/about' ? 'About' : path.includes('skills') ? 'Skills' : 'Contact');
  const current = links.find(el => el.hasAttribute('data-cell-selected'));
  assert.equal(page.nav.properties.get('--cell-x'), `${current.offsetLeft}px`);
  const contact = links.find(el => el.href === '/contact');
  page.nav.events.get('pointerover')({target: contact, pointerType: 'mouse'});
  assert.equal(page.nav.properties.get('--cell-x'), `${contact.offsetLeft}px`);
  page.nav.events.get('pointerleave')();
  assert.equal(page.nav.properties.get('--cell-x'), `${current.offsetLeft}px`);
  page.nav.events.get('focusin')({target: contact});
  assert.equal(contact.hasAttribute('data-cell-selected'), true);
  const duration = page.context.PortfolioMenu.select('/contact');
  assert.equal(duration, current === contact ? 180 : 420);
  page.nav.events.get('pointerleave')();
  assert.equal(contact.hasAttribute('data-cell-selected'), true, 'selection persists when the pointer leaves');
  contact.offsetWidth = 86; page.resize();
  assert.equal(page.nav.properties.get('--cell-width'), '86px', 'align the glass after font or viewport resizing');
  page.events.get('pageshow')({persisted: true});
  assert.equal(current.hasAttribute('data-cell-selected'), true, 'back navigation restores the real current page');
  page.reduced.matches = true;
  assert.equal(page.context.PortfolioMenu.select('/skills'), 0);
  assert.equal(page.nav.scroll.behavior, 'auto');
}
console.log('Passed: glass selection, hover, keyboard focus, mobile scrolling, resizing, history and reduced motion on internal pages; Home has no menu.');
