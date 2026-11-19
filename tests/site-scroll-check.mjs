import {spawn} from 'node:child_process';
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const folder = fileURLToPath(new URL('../artifacts/site-scroll-check/', import.meta.url));
await mkdir(folder, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9264', `--user-data-dir=${folder}/browser-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
let socket;
const report = {checks: [], errors: [], failedRequests: []};
try {
  let page;
  for (let i = 0; i < 40; i++) {
    try { page = (await (await fetch('http://127.0.0.1:9264/json/list')).json()).find(p => p.type === 'page'); } catch {}
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
  const navigate = async path => {const previous=await evaluate('performance.timeOrigin');await call('Page.navigate',{url:'http://127.0.0.1:8080'+path});for(let i=0;i<40;i++){if(await evaluate('performance.timeOrigin !== '+previous))break;await pause(100);}await settle(path);};
  const tap = async selector => {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing control: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await call('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await call('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(350);
  };
  const read = () => evaluate(`(() => {
    const text=[...document.querySelectorAll('.scroll-text-character')].map(e=>+getComputedStyle(e).opacity);
    const native=[...document.querySelectorAll('[data-scroll-text] span[style*="--scroll-text-opacity"]')].map(e=>+e.style.getPropertyValue('--scroll-text-opacity'));
    return {count:window.PortfolioScrollText?.count,units:text.length+native.length,values:[...text,...native],width:innerWidth,scrollWidth:document.documentElement.scrollWidth,menu:document.querySelectorAll('.cell-top-menu').length,header:document.querySelectorAll('.portfolio-context-bar').length};
  })()`);
  for (const width of [390,1440]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
    for(const path of ['/','/portfolio','/skills','/contact','/about','/portfolio/script-change-management','/portfolio/procurement-erp','/portfolio/defect-management']) {
      await navigate(path);await pause(2000);
      const initial=await read();
      if (!initial.count || !initial.units || initial.scrollWidth>width || initial.header || initial.menu!==(path==='/'?0:1)) throw Error('Initial layout/motion failure: '+path+' '+JSON.stringify(initial));
      const textIntact=await evaluate(`[...document.querySelectorAll('.scroll-text-accessible')].every(el=>el.textContent===el.nextElementSibling.textContent)`);
      if(!textIntact)throw Error('Text changed while applying scroll effect: '+path);
      await evaluate(`scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);await pause(500);
      const bottom=await read();
      if(!bottom.values.every(value=>value>.99))throw Error('Some text never completes: '+path+' '+JSON.stringify(bottom.values.filter(v=>v<.99)));
      await evaluate(`scrollTo({top:0,behavior:'instant'})`);await pause(500);
      const rewind=await read();
      if(initial.values.some(v=>v<.3) && !rewind.values.some(v=>v<.3))throw Error('Reveal should reverse on scroll up: '+path);
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(250);
      if(!(await read()).values.every(value=>value>.99))throw Error('Reduced motion should show all text: '+path);
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await pause(250);
      if(path==='/') {
        const point=await evaluate(`(() => {const el=document.querySelector('.framer-qHF7D');const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await pause(600);
        if(await evaluate(`document.querySelectorAll('.cell-top-menu').length`))throw Error('Home menu returned');
      }
      if(path==='/skills' && !await evaluate(`getComputedStyle(document.querySelector('.skills-glow')).animationName.includes('skills-glow-pulse')`))throw Error('Skills glow was lost');
      const name=(path==='/'?'home':path.slice(1).replaceAll('/','-'))+'-'+width;
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${folder}/${name}.png`,Buffer.from(shot.data,'base64'));
      report.checks.push({path,width,blocks:initial.count,units:initial.units,dimAtStart:initial.values.filter(v=>v<.3).length});
      console.log(JSON.stringify(report.checks.at(-1)));
    }
  }
  if(report.errors.length)throw Error(report.errors.join('\n'));
  const failed=report.failedRequests.filter(item=>!item.url.endsWith('/favicon.ico'));
  if(failed.length)throw Error(JSON.stringify(failed));
} catch(error) {
  process.exitCode=1;report.failure=error.stack;console.error(error.stack);
} finally {
  await writeFile(`${folder}/report.json`,JSON.stringify(report,null,2));socket?.close();chrome.kill();
}
