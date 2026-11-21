import {spawn} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../artifacts/project-certificates-check/', import.meta.url));
await mkdir(folder, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9233', `--user-data-dir=${folder}/browser-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
let socket;
const report = {checks: [], errors: [], failedRequests: []};
try {
  let page;
  for (let i = 0; i < 40; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9233/json/list')).json()).find(p => p.type === 'page'); } catch {}
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
    for (let i = 0; i < 30; i++) {
      if (await evaluate(`location.pathname === ${JSON.stringify(expected)} && document.readyState !== 'loading'`)) { await pause(800); return; }
      await pause(200);
    }
    throw Error(`Navigation did not reach ${expected}; actual URL: ${await evaluate('location.href')}`);
  };
  const navigate = async path => { await call('Page.navigate', {url: 'http://127.0.0.1:8080' + path}); await settle(path); };
  const tap = async selector => {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center',behavior:'instant'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await call('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await call('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(350);
  };
  const capture = async name => {
    const state = await evaluate(`(() => ({url:location.href, width:innerWidth, scrollWidth:document.documentElement.scrollWidth, theme:document.documentElement.getAttribute('framestack-theme'), headings:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()), images:[...document.images].filter(e=>e.getClientRects().length).map(e=>({src:e.currentSrc,loaded:e.complete&&e.naturalWidth>0})), links:[...document.querySelectorAll('a[href]')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim()||e.getAttribute('aria-label'),href:e.getAttribute('href')})), overflow:[...document.querySelectorAll('nav p, h1, h2, .framer-Xr4Z8 p')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})).filter(e=>e.x< -1||e.right>innerWidth+1)}))()`);
    const clip = await evaluate(`(() => {const r=document.querySelector('#project-title-foome').closest('article').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
    const shot = await call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip});
    await writeFile(`${folder}/${name}.png`, Buffer.from(shot.data, 'base64'));
    report.checks.push({name, ...state});
    console.log(JSON.stringify({name, width:state.width, scrollWidth:state.scrollWidth, theme:state.theme, overflow:state.overflow.length, unloaded:state.images.filter(i=>!i.loaded).length}));
  };
  for (const width of [390, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<700});
    await navigate('/portfolio');
    if (await evaluate(`document.querySelectorAll('.portfolio-certificate-button').length`) !== 2) throw Error('Certificate buttons must only appear on FRP and UAV');
    for (const id of ['foome','edbost']) {
      const panel = '#project-certificate-'+id;
      const control = panel+' > summary';
      await tap(control);
      const shown = await evaluate(`(() => {const panel=document.querySelector(${JSON.stringify(panel)}); return {open:panel.open,text:panel.querySelector('.portfolio-certificate-panel').innerText};})()`);
      if (!shown.open || !shown.text) throw Error('Certificate did not open: '+JSON.stringify(shown));
      report.checks.push({name:'disclosure-'+id+'-'+width,...shown});
      if (id==='foome') await capture('frp-certificate-'+width);
      await tap(control);
      if (await evaluate(`document.querySelector(${JSON.stringify(panel)}).open`)) throw Error('Certificate did not close');
    }
  }
  await call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/portfolio');
  const transitions = await evaluate(`getComputedStyle(document.querySelector('.portfolio-project-certificate')).transitionDuration`);
  if (transitions!=='0s') throw Error('Reduced motion still animates: '+transitions);
  console.log('Passed certificate disclosures, mobile/desktop, and reduced motion.');

} catch (error) {
  process.exitCode = 1;
  report.failure = error.stack;
  console.error(error.stack);
} finally {
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  socket?.close();
  chrome.kill();
}
