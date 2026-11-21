import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/scripts/contact/email-draft.js', import.meta.url), 'utf8');

function contactPage({fetchResponse, demo = false} = {}) {
  const requests = [], observers = [];
  class Element {
    value = ''; textContent = ''; disabled = true; hidden = false;
    attributes = new Map(); listeners = new Map(); children = [];
    matches = new Map(); valid = true; resetCount = 0;
    querySelector(selector) { return this.matches.get(selector); }
    querySelectorAll() { return this.children; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener(type, listener) {
      const list = this.listeners.get(type) || [];
      this.listeners.set(type, [...list, listener]);
    }
    dispatch(type) {
      return Promise.all((this.listeners.get(type) || []).map(callback => callback({
        preventDefault() {}, stopImmediatePropagation() {}
      })));
    }
    setCustomValidity(message) { this.validationMessage = message; }
    reportValidity() { return this.valid; }
    reset() { this.resetCount++; for (const field of this.fields || []) field.value = ''; }
  }
  const form = new Element(), name = new Element(), email = new Element(), message = new Element();
  const honey = new Element(), submit = new Element(), caption = new Element();
  name.value = ' Jane Doe '; email.value = 'jane@example.com'; message.value = ' Please contact me. ';
  form.fields = [name, email, message, honey];
  for (const [selector, element] of [['[name="Name"]', name], ['[name="Email"]', email],
    ['[name="Details"]', message], ['[name="website"]', honey], ['[type="submit"]', submit]]) form.matches.set(selector, element);
  submit.matches.set('p', caption);
  const demoForm = new Element(), project = new Element(), reply = new Element(), demoSubmit = new Element();
  project.selectedOptions = [{textContent: 'Smart Procurement ERP Logging System'}];
  reply.value = 'demo@example.com'; demoForm.fields = [reply];
  demoForm.matches.set('[type="submit"]', demoSubmit);
  const tabList = new Element();
  const document = {
    documentElement: new Element(), createElement: () => new Element(),
    querySelector: selector => selector === '.contact-tabs' && demo ? tabList : null,
    querySelectorAll: () => demo ? [form, demoForm] : [form],
    getElementById: id => ({'contact-demo-form': demoForm, 'contact-demo-project': project, 'contact-demo-reply': reply})[id]
  };
  const fetch = async (url, options) => {
    requests.push({url, options, payload: JSON.parse(options.body)});
    return fetchResponse ? fetchResponse(requests.length, options) : {ok: true, json: async () => ({success: 'true'})};
  };
  vm.runInNewContext(source, {
    document, window: {addEventListener() {}}, location: {origin: 'https://gkkarthik224.github.io'},
    MutationObserver: class {constructor(callback) { observers.push(callback); } observe() {}},
    fetch, AbortController, setTimeout: () => 1, clearTimeout() {}
  });
  return {form, name, email, message, honey, submit, caption, demoForm, reply, demoSubmit, requests,
    status: form.children[0], demoStatus: demoForm.children[0], remount: () => observers[0]()};
}

test('contact messages post to the confirmed inbox without opening an email app', async () => {
  const page = contactPage();
  await page.form.dispatch('submit');
  assert.equal(page.requests.length, 1);
  const {url, options, payload} = page.requests[0];
  assert.equal(url, 'https://formsubmit.co/ajax/gkrishnakarthik2004@gmail.com');
  assert.equal(options.method, 'POST');
  assert.equal(payload.name, 'Jane Doe');
  assert.equal(payload.email, 'jane@example.com');
  assert.equal(payload.message, 'Please contact me.');
  assert.equal(payload._url, 'https://gkkarthik224.github.io/contact/');
  assert.equal(page.status.getAttribute('data-state'), 'success');
  assert.equal(page.form.resetCount, 1);
  assert.equal(page.submit.disabled, false);
  assert.equal(page.message.required, true);
});

test('HTTP 200 with success false preserves the message for retry', async () => {
  const page = contactPage({fetchResponse: async count => ({ok: true,
    json: async () => ({success: count === 1 ? 'false' : 'true'})})});
  await page.form.dispatch('submit');
  assert.equal(page.status.getAttribute('data-state'), 'error');
  assert.equal(page.message.value, ' Please contact me. ');
  assert.equal(page.form.resetCount, 0);
  await page.form.dispatch('submit');
  assert.equal(page.status.getAttribute('data-state'), 'success');
  assert.equal(page.requests.length, 2);
});

test('duplicate submits and remounts cannot re-enable a pending submission', async () => {
  let release;
  const page = contactPage({fetchResponse: () => new Promise(resolve => { release = resolve; })});
  const first = page.form.dispatch('submit');
  const second = page.form.dispatch('submit');
  page.remount();
  assert.equal(page.submit.disabled, true);
  assert.equal(page.caption.textContent, 'Sending…');
  assert.equal(page.requests.length, 1);
  release({ok: true, json: async () => ({success: true})});
  await Promise.all([first, second]);
  assert.equal(page.submit.disabled, false);
  assert.equal(page.form.hasAttribute('aria-busy'), false);
});

test('whitespace-only names and invalid forms never send requests', async () => {
  const page = contactPage();
  page.name.value = '  ';
  await page.form.dispatch('submit');
  assert.ok(page.name.validationMessage);
  assert.equal(page.requests.length, 0);
  page.name.value = 'Jane'; page.form.valid = false;
  await page.form.dispatch('submit');
  assert.equal(page.requests.length, 0);
});

test('the existing honeypot prevents bot submissions', async () => {
  const page = contactPage();
  page.honey.value = 'spam';
  await page.form.dispatch('submit');
  assert.equal(page.requests.length, 0);
});

test('network errors preserve the enquiry and restore the Send button', async () => {
  const page = contactPage({fetchResponse: async () => { throw new Error('Offline'); }});
  await page.form.dispatch('submit');
  assert.equal(page.status.getAttribute('data-state'), 'error');
  assert.equal(page.message.value, ' Please contact me. ');
  assert.equal(page.submit.disabled, false);
  assert.equal(page.caption.textContent, 'Send');
});

test('a demo request includes its project and reply email', async () => {
  const page = contactPage({demo: true});
  await page.demoForm.dispatch('submit');
  assert.equal(page.requests[0].payload.project, 'Smart Procurement ERP Logging System');
  assert.equal(page.requests[0].payload.email, 'demo@example.com');
  assert.match(page.requests[0].payload._subject, /^Demo request:/);
  assert.equal(page.demoStatus.getAttribute('data-state'), 'success');
});

test('phone demo requests are accepted without creating a fake email address', async () => {
  const page = contactPage({demo: true});
  page.reply.value = '+91 98765 43210';
  await page.demoForm.dispatch('submit');
  assert.equal(page.requests[0].payload.phone, '+91 98765 43210');
  assert.equal(page.requests[0].payload.email, undefined);
});

test('invalid demo contact details do not submit', async () => {
  const page = contactPage({demo: true});
  page.reply.value = 'not a contact';
  await page.demoForm.dispatch('submit');
  assert.equal(page.requests.length, 0);
  assert.match(page.reply.validationMessage, /valid email address or phone/);
});
