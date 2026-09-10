// Real network/media against the repaired local fixture; never writes to production.
import { chromium } from 'playwright';
import { startServer } from './fixture-server.mjs';
import { verifyPlayback } from './playback.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const server=await startServer(4175), browser=await chromium.launch();
fs.mkdirSync('artifacts/integration',{recursive:true});
const results=[];
const watchdog=setTimeout(()=>{console.error('Integration external watchdog');process.exit(1)},360000);
try {
  for(const [name,width,height,cpu,slow] of [
    ['desktop',1440,900,1,false],['mobile390',390,844,1,false],['mobile430-slow4g-cpu4',430,932,4,true]
  ]) {
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height},isMobile:width<500,hasTouch:width<500,
      recordHar:{path:'artifacts/integration/'+name+'.har',content:'omit'}});
    // No routing: Chromium's real HTTP cache and network throttling remain enabled.
    await context.addInitScript(()=>{
      window.__runtime={beats:0,maxGap:0,mutations:0,observerCalls:0,ownRaf:0,longTasks:[]};
      let previous=performance.now();
      setInterval(()=>{const now=performance.now();window.__runtime.beats++;window.__runtime.maxGap=Math.max(window.__runtime.maxGap,now-previous);previous=now},250);
      const Native=window.MutationObserver;
      window.MutationObserver=function(cb){return new Native((records,observer)=>{window.__runtime.observerCalls++;cb(records,observer)})};
      new Native(records=>window.__runtime.mutations+=records.length).observe(document,{subtree:true,childList:true,characterData:true});
      const raf=window.requestAnimationFrame;
      window.requestAnimationFrame=cb=>{if(/dojo(?:\.[a-f0-9]+)?\.js|tracking(?:\.[a-f0-9]+)?\.js/.test(new Error().stack))window.__runtime.ownRaf++;return raf(cb)};
      new PerformanceObserver(list=>window.__runtime.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration,name:e.name,attribution:e.attribution.map(a=>({name:a.name,src:a.containerSrc}))})))).observe({type:'longtask'});
    });
    const page=await context.newPage(), cdp=await context.newCDPSession(page);
    const errors=[],failures=[],cache=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()}));
    await cdp.send('Network.enable');
    cdp.on('Network.responseReceived',e=>{if(e.response.fromDiskCache||e.response.fromPrefetchCache)cache.push(e.response.url)});
    await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
    if(slow) await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
    const began=Date.now();
    const result={name,cpu,network:slow?'1.6 Mbps / 150 ms':'unthrottled',errors,failures,cache};results.push(result);
    await page.goto('https://127.0.0.1:4175/?utm_source=youtube&utm_medium=video&utm_campaign=integration',{waitUntil:'domcontentloaded',timeout:60000});
    result.dclMs=Date.now()-began;
    if (width<500) {
      assert.equal(await page.locator('#dojoVideo').count(),0,'Mobile YouTube must be deferred until interaction');
      await page.evaluate(()=>scrollBy(0,1));
      await page.waitForTimeout(50);
      if (await page.locator('#dojoVideoFacade').count())
        await page.evaluate(()=>document.getElementById('dojoVideoFacade').scrollIntoView({block:'center'}));
      await page.locator('#dojoVideo').waitFor();
    } else {
      await page.locator('#dojoVideo').waitFor();
    }
    result.playback=await verifyPlayback(page,60000);
    if(await page.locator('#sk-ep').isVisible()) await page.locator('.sk-ep-x').click();
    await page.screenshot({path:'artifacts/integration/'+name+'-hero.png'});
    // Suppress the existing mobile timer while collecting sequential interaction measurements.
    await page.locator('.sk-fp-float').click();await page.locator('.sk-ep-x').click();
    result.scrollStart=await page.evaluate(()=>performance.now());
    for(const section of await page.locator('#sk-std section').all()){
      await section.scrollIntoViewIfNeeded();await page.waitForTimeout(120);
      assert.ok(await section.evaluate(el=>el.getBoundingClientRect().height>0));
    }
    result.scrollEnd=await page.evaluate(()=>performance.now());
    await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
    await page.screenshot({path:'artifacts/integration/'+name+'-chooser.png'});
    await page.locator('.sk-plan-close').click();
    await page.locator('[data-proof-src]').first().click();
    await page.locator('#djLightbox img').evaluate(img=>img.decode()).catch(e=>failures.push({imageDecode:e.message}));
    await page.screenshot({path:'artifacts/integration/'+name+'-proof.png'});
    await page.locator('.dj-lightbox-close').click();
    await page.locator('footer.sk-footer').scrollIntoViewIfNeeded();
    await page.screenshot({path:'artifacts/integration/'+name+'-footer.png'});
    await page.waitForTimeout(Math.max(0,35000-(Date.now()-began)));
    result.elapsedMs=Date.now()-began;
    result.runtime=await page.evaluate(()=>window.__runtime);
    result.metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    fs.writeFileSync('artifacts/integration/'+name+'.cpuprofile',JSON.stringify((await cdp.send('Profiler.stop')).profile));
    assert.equal(result.runtime.ownRaf,0);
    assert.ok(result.runtime.observerCalls<1000,'No sustained mutation storm');
    assert.ok(result.runtime.beats>100,'Heartbeat must survive 35-second media integration');
    assert.deepEqual(result.runtime.longTasks.filter(t=>t.start>=result.scrollStart&&t.start<=result.scrollEnd&&t.name==='self'&&t.duration>100),[],'No main-page scrolling task over 100ms');
    assert.deepEqual(errors,[]);
    const reload=Date.now();await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    result.warmDclMs=Date.now()-reload;
    await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
    assert.equal(await page.locator('#sk-plan-chooser').isVisible(),true);
    await page.locator('.sk-plan-close').click();
    result.warmResources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/wp-content/plugins/')).map(e=>({url:e.name,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize})));
    assert.ok(result.warmResources.some(r=>r.url.endsWith('/dojo.js')&&r.transferSize===0),'Warm cache must actually be exercised');
    await context.close();
    console.log(JSON.stringify({name,dclMs:result.dclMs,warmDclMs:result.warmDclMs,playback:result.playback,runtime:result.runtime}));
  }
} finally {
  fs.writeFileSync('artifacts/integration/results.json',JSON.stringify(results,null,2));
  clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));
}
