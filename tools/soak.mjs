import { chromium } from 'playwright';
import { startServer } from './fixture-server.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const server=await startServer(4174);
const browser=await chromium.launch();
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
await context.addInitScript(()=>{
  window.__soak={beats:0,maxGap:0,mutations:0,raf:0,longTasks:[]};
  let last=performance.now();
  setInterval(()=>{const t=performance.now();window.__soak.maxGap=Math.max(window.__soak.maxGap,t-last);last=t;window.__soak.beats++},250);
  new MutationObserver(records=>{window.__soak.mutations+=records.length}).observe(document,{subtree:true,childList:true,characterData:true});
  const original=window.requestAnimationFrame;
  window.requestAnimationFrame=cb=>original(t=>{window.__soak.raf++;cb(t)});
  if(PerformanceObserver.supportedEntryTypes.includes('longtask'))
    new PerformanceObserver(list=>window.__soak.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask'});
});
const page=await context.newPage(), cdp=await context.newCDPSession(page);
await cdp.send('Performance.enable');
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const watchdog=setTimeout(()=>{console.error('Soak external watchdog: renderer stalled');process.exit(1)},360000);
const samples=[];
try{
  await page.goto('https://127.0.0.1:4174/');
  // WPCode reads session suppression at initialization; dismiss and reload once.
  // The separate 35-second matrix explicitly tests its unsuppressed timer.
  await page.locator('.sk-fp-float').click();await page.locator('.sk-ep-x').click();
  await page.reload();
  const started=Date.now();
  while(Date.now()-started<300000){
    for(const section of await page.locator('#sk-std section').all()){
      await section.scrollIntoViewIfNeeded();await page.waitForTimeout(80);
    }
    await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
    await page.locator('.sk-plan-close').click();
    await page.locator('[data-proof-src]').first().click();
    await page.locator('.dj-lightbox-close').click();
    await page.locator('.sk-fp-float').click();await page.locator('.sk-ep-x').click();
    await page.evaluate(()=>scrollTo(0,0));
    await page.waitForTimeout(1000);
    if(!samples.length || Date.now()-started-samples.at(-1).elapsed>30000){
      await cdp.send('HeapProfiler.collectGarbage');
      const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      samples.push({elapsed:Date.now()-started,heap:metrics.JSHeapUsedSize,nodes:metrics.Nodes,listeners:metrics.JSEventListeners,
        state:await page.evaluate(()=>window.__soak)});
      console.log(JSON.stringify({...samples.at(-1),state:undefined}));
    }
  }
  assert.deepEqual(errors,[]);
  assert.ok(samples.at(-1).state.beats>1000,'Heartbeat must continue throughout soak');
  assert.ok(samples.at(-1).state.maxGap<1000,'No sustained main-thread lock');
  assert.ok(samples.at(-1).nodes-samples[1].nodes<30,'No accumulating retained DOM');
  assert.ok(samples.at(-1).listeners-samples[1].listeners<5,'No accumulating listeners');
  assert.ok(samples.at(-1).heap-samples[1].heap<2*1024*1024,'No unbounded retained heap growth');
  assert.ok(samples.at(-1).state.mutations<10000,'No mutation storm');
  assert.ok(samples.at(-1).state.longTasks.filter(e=>e.start>3000&&e.duration>100).length===0,'No scrolling task over 100ms');
  assert.equal(await page.locator('#sk-plan-chooser').count(),1);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('dojo-dialog-open')||document.documentElement.style.overflow==='hidden'),false);
}finally{
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/soak.json',JSON.stringify({samples,errors},null,2));
  clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));
}
