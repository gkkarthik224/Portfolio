import {spawn} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../artifacts/browser-smoke/', import.meta.url));
await mkdir(folder, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9227', `--user-data-dir=${folder}/browser-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
let socket;
const report = {checks: [], errors: [], failedRequests: []};
try {
  let page;
  for (let i = 0; i < 40; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9227/json/list')).json()).find(p => p.type === 'page'); } catch {}
    if (page) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (!page) throw Error('Owned browser did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id);
      if (!p) return;
      clearTimeout(p.timer); pending.delete(message.id);
      if (message.error) p.reject(Error(JSON.stringify(message.error))); else p.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) report.failedRequests.push({url: message.params.response.url, status: message.params.response.status});
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    const timer = setTimeout(() => { pending.delete(next); reject(Error(`Timed out: ${method}`)); }, 15000);
    pending.set(next, {resolve, reject, timer}); socket.send(JSON.stringify({id: next, method, params}));
  });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const pause = ms => new Promise(r => setTimeout(r, ms));
  await Promise.all([call('Page.enable'), call('Runtime.enable'), call('Network.enable')]);
  await call('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await call('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1});
  const settle = async expected => {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`location.pathname === ${JSON.stringify(expected)} && document.readyState !== 'loading' && document.documentElement.hasAttribute('data-page-ready')`)) { await pause(800); return; }
      await pause(200);
    }
    throw Error(`Navigation did not reach ${expected}; actual URL: ${await evaluate('location.href')}`);
  };
  const navigate = async path => { await call('Page.navigate', {url: 'http://127.0.0.1:8080' + path}); await settle(path); };
  const tap = async selector => {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await call('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await call('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(350);
  };
  const capture = async name => {
    const state = await evaluate(`(() => {
      const nav = document.querySelector('.cell-top-menu');
      const selected = nav?.querySelector('[aria-current="page"]');
      const menu = selected ? (() => {
        const box = nav.getBoundingClientRect(), item = selected.getBoundingClientRect();
        return {left:item.left,right:item.right,menuLeft:box.left,menuRight:box.right};
      })() : null;
      const visibleHeaders = [...document.querySelectorAll('.portfolio-context-bar,.about-header,.skills-header,nav.framer-Txym4')].filter(el => el.getClientRects().length).length;
      const menuTop = document.querySelector('.cell-top-menu')?.getBoundingClientRect().top;
      return {url:location.href,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.getAttribute('framestack-theme'),visibleHeaders,menuTop,headings:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()),images:[...document.images].filter(e=>e.getClientRects().length).map(e=>({src:e.currentSrc,loaded:e.complete&&e.naturalWidth>0})),links:[...document.querySelectorAll('a[href]')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim()||e.getAttribute('aria-label'),href:e.getAttribute('href')})),menu,overflow:[...document.querySelectorAll('nav p, h1, h2, .framer-Xr4Z8 p')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})).filter(e=>e.x< -1||e.right>innerWidth+1)};
    })()`);
    if (state.scrollWidth > state.width) throw Error(`${name} has horizontal page overflow: ${state.scrollWidth}px > ${state.width}px`);
    if (state.visibleHeaders !== 0) throw Error(`${name} still shows the removed top bar: ${state.visibleHeaders}`);
    if (name.startsWith('home') ? state.menu !== null : state.menu === null) throw Error(`${name} has unexpected menu visibility`);
    const menuTopRange = [0, 24];
    if (state.menuTop < menuTopRange[0] || state.menuTop > menuTopRange[1]) throw Error(`${name} floating menu is misplaced: ${state.menuTop}`);
    if (state.menu && (state.menu.left < state.menu.menuLeft - 1 || state.menu.right > state.menu.menuRight + 1)) {
      throw Error(`${name} has a clipped selected menu item: ${JSON.stringify(state.menu)}`);
    }
    if (name.startsWith('contact')) {
      const contacts = await evaluate(`(() => ({
        email: [...document.querySelectorAll('a[href^="mailto:"]')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
        phone: [...document.querySelectorAll('a[href^="tel:"]')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
        linkedin: [...document.querySelectorAll('a[href*="linkedin.com"]')].map(a => [a.textContent.trim(), a.getAttribute('href')])
      }))()`);
      const emailOk = contacts.email.some(([label, url]) => label.includes('gkrishankarthik2004@gmail.com') && url === 'mailto:gkrishankarthik2004@gmail.com');
      const phoneOk = contacts.phone.some(([label, url]) => label.includes('99517 85195') && url === 'tel:+919951785195');
      const linkedinOk = contacts.linkedin.some(([label, url]) => label.includes('Karthik Krishna') && url === 'https://in.linkedin.com/in/karthik-krishna-913068289');
      if (!emailOk || !phoneOk || !linkedinOk) {
        throw Error(`Contact details were not updated: ${JSON.stringify(contacts)}`);
      }
    }
    const shot = await call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    await writeFile(`${folder}/${name}.png`, Buffer.from(shot.data, 'base64'));
    report.checks.push({name, ...state});
    console.log(JSON.stringify({name, width:state.width, scrollWidth:state.scrollWidth, theme:state.theme, overflow:state.overflow.length, unloaded:state.images.filter(i=>!i.loaded).length}));
  };
  for (const width of [320, 360, 390, 430, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<700});
    for (const [path,name] of [['/','home'],['/about','about'],['/portfolio','portfolio'],['/contact','contact'],['/skills','skills'],['/portfolio/script-change-management','project'],['/portfolio/procurement-erp','procurement'],['/portfolio/defect-management','defects']]) {
      await navigate(path); await pause(900); await capture(name+'-'+width);
    }
  }
} catch (error) {
  process.exitCode = 1;
  report.failure = error.stack;
  console.error(error.stack);
} finally {
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  socket?.close();
  chrome.kill();
}
