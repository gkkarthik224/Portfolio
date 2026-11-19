import {spawn} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../artifacts/about-scroll-check/', import.meta.url));
await mkdir(folder, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9260', `--user-data-dir=${folder}/browser-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
let socket;
const report = {checks: [], errors: [], failedRequests: []};
try {
  let page;
  for (let i = 0; i < 40; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9260/json/list')).json()).find(p => p.type === 'page'); } catch {}
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
  for (const width of [390, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<700});
    await navigate('/about');
    await pause(2200);
    const original = await evaluate(`document.querySelector('.about-bio .scroll-text-accessible').textContent`);
    const visual = await evaluate(`document.querySelector('.about-bio .scroll-text-visual').textContent`);
    if (original !== visual) throw Error('Scroll split changed the biography');
    const initial = await evaluate(`({opacity:[...document.querySelectorAll('.about-experience > p .scroll-text-character')].map(e=>+getComputedStyle(e).opacity),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,menu:document.querySelectorAll('.cell-top-menu').length,headers:document.querySelectorAll('.portfolio-context-bar').length,title:document.querySelector('#about-title').getAttribute('aria-label')})`);
    if (initial.width < initial.scrollWidth || initial.menu !== 1 || initial.headers !== 0 || initial.title !== 'About') throw Error('About layout regressed: '+JSON.stringify(initial));
    if (!initial.opacity.some(value => value <= .21)) throw Error('Offscreen text should start dim');
    await call('Input.dispatchMouseEvent', {type:'mouseWheel',x:width/2,y:700,deltaY:220,deltaX:0});
    await pause(50); const wheelStart=await evaluate('scrollY');
    await pause(350); const wheelLater=await evaluate('scrollY');
    if (wheelLater <= wheelStart) throw Error('Wheel scrolling should ease toward its destination');
    await pause(1000);
    await evaluate(`document.querySelector('.about-experience > p').scrollIntoView({block:'start',behavior:'instant'})`);
    await pause(500);
    const bright = await evaluate(`[...document.querySelectorAll('.about-experience > p:first-of-type .scroll-text-character')].map(e=>+getComputedStyle(e).opacity)`);
    if (!bright.every(value=>value > .99)) throw Error('Scrolled paragraph should be fully bright');
    await evaluate(`scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`); await pause(350);
    if (!await evaluate(`[...document.querySelectorAll('.scroll-text-character')].every(e=>+getComputedStyle(e).opacity>.99)`)) throw Error('All text should be readable at the page bottom');
    const screenshot = await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
    await writeFile(`${folder}/about-scroll-${width}.png`,Buffer.from(screenshot.data,'base64'));
    await evaluate(`scrollTo({top:0,behavior:'instant'})`); await pause(500);
    const rewind = await evaluate(`[...document.querySelectorAll('.about-experience > p .scroll-text-character')].map(e=>+getComputedStyle(e).opacity)`);
    if (!rewind.some(value=>value <= .21)) throw Error('Scroll effect should reverse when scrolling up');
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(200);
    const reduced = await evaluate(`[...document.querySelectorAll('.scroll-text-character')].every(e=>getComputedStyle(e).opacity==='1')`);
    if (!reduced) throw Error('Reduced motion should keep all text fully readable');
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await pause(200);
    report.checks.push({width,characters:initial.opacity.length,wheelStart,wheelLater,reduced});
    console.log(JSON.stringify(report.checks.at(-1)));
  }
  if(report.errors.length || report.failedRequests.length) throw Error(JSON.stringify({errors:report.errors,failedRequests:report.failedRequests}));
} catch(error) {
  process.exitCode=1;report.failure=error.stack;console.error(error.stack);
} finally {
  await writeFile(`${folder}/report.json`,JSON.stringify(report,null,2));socket?.close();chrome.kill();
}
