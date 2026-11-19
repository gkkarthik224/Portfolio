import {spawn} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../artifacts/home-cells-check/', import.meta.url));
await mkdir(folder, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9238', `--user-data-dir=${folder}/browser-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
let socket;
const report = {checks: [], errors: [], failedRequests: []};
try {
  let page;
  for (let i = 0; i < 40; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9238/json/list')).json()).find(p => p.type === 'page'); } catch {}
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
  const navigate = async path => {
    const previous = await evaluate('performance.timeOrigin');
    await call('Page.navigate', {url: 'http://127.0.0.1:8080' + path});
    for (let attempt=0;attempt<80;attempt++) {
      try {
        if(await evaluate(`performance.timeOrigin!==${previous} && location.pathname===${JSON.stringify(path)} && document.readyState==='complete' && !!window.PortfolioTheme && !!window.PortfolioMotion?.ready && document.querySelectorAll('.framer-TlDBu [data-home-cell-link]').length===5`)) {await pause(350);return;}
      } catch {}
      await pause(150);
    }
    throw Error('Home did not finish loading');
  };
  const tap = async selector => {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await call('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await call('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(350);
  };
  const capture = async name => {
    const state = await evaluate(`(() => ({url:location.href, width:innerWidth, scrollWidth:document.documentElement.scrollWidth, theme:document.documentElement.getAttribute('framestack-theme'), headings:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()), images:[...document.images].filter(e=>e.getClientRects().length).map(e=>({src:e.currentSrc,loaded:e.complete&&e.naturalWidth>0})), links:[...document.querySelectorAll('a[href]')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim()||e.getAttribute('aria-label'),href:e.getAttribute('href')})), overflow:[...document.querySelectorAll('nav p, h1, h2, .framer-Xr4Z8 p')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})).filter(e=>e.x< -1||e.right>innerWidth+1)}))()`);
    if (name.startsWith('contact')) {
      const contacts = await evaluate(`(() => ({
        email: [...document.querySelectorAll('a[href^="mailto:"]')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
        phone: [...document.querySelectorAll('a[href^="tel:"]')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
        linkedin: [...document.querySelectorAll('a[href*="linkedin.com"]')].map(a => [a.textContent.trim(), a.getAttribute('href')])
      }))()`);
      const matches = (items, text, href) => items.length > 0 && items.every(([label, url]) => label === text && url === href);
      if (!matches(contacts.email, 'gkrishnakarthik2004@gmail.com', 'mailto:gkrishnakarthik2004@gmail.com')
        || !matches(contacts.phone, '+919951785195', 'tel:+919951785195')
        || !matches(contacts.linkedin, 'karthik-krishna-913068289', 'https://in.linkedin.com/in/karthik-krishna-913068289')) {
        throw Error(`Contact details were not updated: ${JSON.stringify(contacts)}`);
      }
    }
    state.surfaces = await evaluate(`[...document.querySelectorAll('.framer-TlDBu a.framer-qHF7D')].map(el=>{const r=el.getBoundingClientRect();return {href:el.getAttribute('href'),x:r.x,y:r.y,width:r.width,height:r.height};})`);
    const shot = await call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    await writeFile(`${folder}/${name}.png`, Buffer.from(shot.data, 'base64'));
    report.checks.push({name, ...state});
    console.log(JSON.stringify({name, width:state.width, scrollWidth:state.scrollWidth, theme:state.theme, overflow:state.overflow.length, unloaded:state.images.filter(i=>!i.loaded).length}));
  };
  for(const width of [1440,1024,390]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
    await call('Emulation.setTouchEmulationEnabled',{enabled:width<700,maxTouchPoints:1});
    await navigate('/');await evaluate(`window.PortfolioTheme.set('dark')`);await pause(1300);
    for(const index of [0,1,2,3,4]) {
      const point=await evaluate(`(()=>{const e=document.querySelectorAll('.framer-TlDBu [data-home-cell-link]')[${index}];e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await pause(550);
      const interactive=await evaluate(`(()=>{const links=[...document.querySelectorAll('.framer-TlDBu [data-home-cell-link]')]; const active=links[${index}],arrow=active.querySelector('.skills-cell-arrow');return {count:links.length,arrows:links.map(a=>a.querySelectorAll('.skills-cell-arrow').length),colorCount:new Set(links.map(a=>getComputedStyle(a.querySelector('.skills-cell-arrow')).color)).size,shapeCount:new Set(links.map(a=>a.querySelector('.skills-cell-arrow path')?.getAttribute('d'))).size,transform:getComputedStyle(arrow).transform,roll:active.hasAttribute('data-skills-link')?[...active.querySelectorAll('.home-cell-title > span')].map(el=>getComputedStyle(el).transform):null};})()`);
      if(interactive.count!==5||interactive.arrows.some(count=>count!==1)||interactive.shapeCount!==1||interactive.colorCount!==1)throw Error('Arrow mismatch: '+JSON.stringify(interactive));
      if(width>=700&&interactive.transform!=='matrix(1, 0, 0, 1, 0, 0)')throw Error('Arrow did not rotate: '+JSON.stringify(interactive));
      if(width>=700&&interactive.roll&&interactive.roll[1]!=='matrix(1, 0, 0, 1, 0, 0)')throw Error('Skills label did not roll: '+JSON.stringify(interactive));
      const state=await evaluate(`[...document.querySelectorAll('.framer-TlDBu .framer-qHF7D,.framer-TlDBu .framer-DOfiF,.framer-TlDBu .framer-vs50g9')].map(e=>({filter:getComputedStyle(e).backdropFilter,glass:getComputedStyle(e,'::before').backdropFilter}))`);
      if(state.some(e=>e.filter!=='none'||e.glass!=='none'))throw Error(JSON.stringify(state));
      await capture('home-dark-'+width+'-hover-'+index);
    }
    await evaluate(`scrollTo(0,0);window.PortfolioTheme.set('light')`);await pause(300);await capture('home-light-'+width);
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/');
  const reduced=await evaluate(`[...document.querySelectorAll('.skills-cell-arrow,.home-cell-title > span')].every(el=>getComputedStyle(el).transitionDuration==='0s')`);
  if(!reduced)throw Error('Home card interactions still animate under reduced motion');

} catch (error) {
  process.exitCode = 1;
  report.failure = error.stack;
  console.error(error.stack);
} finally {
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  socket?.close();
  chrome.kill();
}
