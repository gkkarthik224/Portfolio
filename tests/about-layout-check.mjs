import {spawn} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../artifacts/about-layout-check/', import.meta.url));
await mkdir(folder, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9231', `--user-data-dir=${folder}/browser-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
let socket;
const report = {checks: [], errors: [], failedRequests: []};
try {
  let page;
  for (let i = 0; i < 40; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9231/json/list')).json()).find(p => p.type === 'page'); } catch {}
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
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await call('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await call('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(350);
  };
  const capture = async name => {
    const state = await evaluate(`(() => ({url:location.href, width:innerWidth, scrollWidth:document.documentElement.scrollWidth, theme:document.documentElement.getAttribute('framestack-theme'), headings:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()), images:[...document.images].filter(e=>e.getClientRects().length).map(e=>({src:e.currentSrc,loaded:e.complete&&e.naturalWidth>0})), links:[...document.querySelectorAll('a[href]')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim()||e.getAttribute('aria-label'),href:e.getAttribute('href')})), overflow:[...document.querySelectorAll('nav p, h1, h2, .framer-Xr4Z8 p')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})).filter(e=>e.x< -1||e.right>innerWidth+1)}))()`);
    const layout = await evaluate(`(() => {const context=document.querySelector('.portfolio-context-bar');return {headers:document.querySelectorAll('header').length,contextBars:document.querySelectorAll('.portfolio-context-bar').length,role:context?.querySelector('.portfolio-context-role')?.textContent.trim(),location:context?.querySelector('.portfolio-context-location')?.textContent.trim(),theme:!!context?.querySelector('.theme-toggle'),mains:document.querySelectorAll('main').length,aboutTitles:[...document.querySelectorAll('h1')].filter(el=>el.textContent==='About').length,portrait:document.querySelector('.about-portrait img')?.naturalWidth,menu:[...document.querySelectorAll('.cell-top-menu a')].map(el=>el.textContent)}})()`);
    if (layout.headers !== 0 || layout.contextBars !== 0 || layout.mains !== 1 || layout.aboutTitles !== 1 || !layout.portrait) throw Error('Duplicate or incomplete About layout: '+JSON.stringify(layout));
    if (state.scrollWidth > state.width || state.overflow.length) throw Error('About content overflows: '+JSON.stringify(state.overflow));
    if (layout.menu.join('|') !== 'Home|Projects|Skills|Contact|Resume|About') throw Error('Wrong menu: '+JSON.stringify(layout.menu));
    const menuBounds = await evaluate(`(() => {const nav=document.querySelector('.cell-top-menu'), selected=nav.querySelector('[aria-current=page]'); const bar=nav.getBoundingClientRect(),cell=selected.getBoundingClientRect();return {left:cell.left,right:cell.right,barLeft:bar.left,barRight:bar.right,scroll:nav.scrollLeft};})()`);
    if (menuBounds.left < menuBounds.barLeft || menuBounds.right > menuBounds.barRight) throw Error('Selected About item is clipped: '+JSON.stringify(menuBounds));
    const shot = await call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    await writeFile(`${folder}/${name}.png`, Buffer.from(shot.data, 'base64'));
    report.checks.push({name, ...state});
    console.log(JSON.stringify({name, width:state.width, scrollWidth:state.scrollWidth, theme:state.theme, overflow:state.overflow.length, unloaded:state.images.filter(i=>!i.loaded).length}));
  };
  for (const width of [320, 360, 390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<700});
    await navigate('/about');
    await evaluate(`window.PortfolioTheme.set('light')`); await pause(1200);
    await capture('about-light-'+width);
    await evaluate(`window.PortfolioTheme.set('dark')`); await pause(350); await capture('about-dark-'+width);
    if (await evaluate(`window.PortfolioTheme.get()`)!=='dark') throw Error('Dark theme failed');
  }
  await call('Emulation.setDeviceMetricsOverride', {width:320,height:900,deviceScaleFactor:1,mobile:true});
  await navigate('/skills');
  await tap('.cell-top-menu a[href="/about"]'); await settle('/about');
  await capture('about-from-menu-320');
  await navigate('/about-loaded.html'); await capture('about-legacy-link');
  if (report.errors.length) throw Error('About runtime errors: '+report.errors.join('\n'));

} catch (error) {
  process.exitCode = 1;
  report.failure = error.stack;
  console.error(error.stack);
} finally {
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  socket?.close();
  chrome.kill();
}
