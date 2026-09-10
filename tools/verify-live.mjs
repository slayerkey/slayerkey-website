import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assetKeys, verifyHTML, verifyBytes } from './release-contract.mjs';
import { verifyPlayback } from './playback.mjs';

const sha = process.env.DEPLOY_SHA;
const rollback = process.env.ROLLBACK_RUNTIME === '1';
assert.match(sha || '', /^[a-f0-9]{40}$/, 'DEPLOY_SHA must identify the expected release');
const browser = await chromium.launch();
const base = 'https://slayerkey.com';
const artifact = process.env.MANIFEST_PATH || 'build/plugin/DEPLOYED_ASSETS.json';
const request = await browser.newContext();
const manifest = fs.existsSync(artifact) ? JSON.parse(fs.readFileSync(artifact)) :
  await (await request.request.get(base + '/wp-content/plugins/slayerkey-website/DEPLOYED_ASSETS.' + sha.slice(0,8) + '.json')).json();
assert.equal(manifest.commit, sha);
await request.close();
fs.mkdirSync('artifacts/live', { recursive:true });
const results=[];
const watchdog=setTimeout(()=>{console.error('External watchdog: production renderer unresponsive');process.exit(1)},360000);
try {
  for (const [name, width, height, url] of [
    ['desktop',1440,900,base+'/'],
    ['mobile390',390,844,base+'/?utm_source=youtube&utm_medium=video&utm_campaign=homepage_smoke'],
    ['mobile430',430,932,base+'/?utm_source=youtube&utm_medium=description&utm_campaign=dojo&utm_content=pinned_comment']
  ]) {
    const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,
      recordHar:{path:'artifacts/live/'+name+'.har'}});
    const page=await context.newPage();
    const errors=[], failures=[], byteFailures=[], assetResponses=[], loaded=new Map(), hashes=[];
    const result={name,url,sha,errors,failures,byteFailures,assetResponses,completed:false};results.push(result);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()}));
    page.on('response',response=>{
      for (const key of assetKeys) {
        if (response.status()===200 && new URL(response.url()).pathname.endsWith('/'+manifest[key]))
          hashes.push(response.body().then(body=>{
            const hash=verifyBytes(body,manifest[key+'_sha256'],key);
            loaded.set(key,hash);assetResponses.push({key,url:response.url(),hash,headers:response.headers()});
          }).catch(error=>byteFailures.push(error.message)));
      }
    });
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    result.headers=response.headers();
    const raw=await response.text();
    verifyHTML(raw,manifest,sha,rollback);
    if (!rollback && width<500) {
      assert.equal(await page.locator('#dojoVideo').count(),0,'Mobile YouTube must be deferred until interaction');
      await page.evaluate(()=>scrollBy(0,1));
      await page.waitForTimeout(50);
      if (await page.locator('#dojoVideoFacade').count())
        await page.evaluate(()=>document.getElementById('dojoVideoFacade').scrollIntoView({block:'center'}));
      await page.locator('#dojoVideo').waitFor();
    } else if (!rollback) {
      await page.locator('#dojoVideo').waitFor();
    }
    const playback=await verifyPlayback(page);
    result.playback=playback;
    if(await page.locator('#sk-ep').isVisible()) await page.locator('.sk-ep-x').click();
    await Promise.all(hashes);
    assert.deepEqual(byteFailures,[]);
    for(const key of ['dojo_js','dojo_css','tracking_js']) assert.equal(loaded.get(key),manifest[key+'_sha256'],'Browser bytes mismatch: '+key);
    const began=Date.now();
    for(const section of await page.locator('#sk-std section').all()) {
      await section.scrollIntoViewIfNeeded();
      assert.ok(await section.evaluate(el=>el.getBoundingClientRect().height>0 && el.textContent.trim().length>20));
    }
    assert.deepEqual(await page.locator('#sk-std .reveal').evaluateAll(els=>els.filter(e=>getComputedStyle(e).opacity!=='1').map(e=>e.className)),[]);
    await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
    assert.equal(await page.locator('#sk-plan-chooser').isVisible(),true);
    await page.locator('.sk-plan-close').click();
    await page.locator('[data-proof-src]').first().click();
    await page.locator('.dj-lightbox-close').click();
    await page.locator('footer.sk-footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(Math.max(0,35000-(Date.now()-began)));
    if(await page.locator('#sk-ep').isVisible()) await page.locator('.sk-ep-x').click();
    await page.locator('.sk-fp-float').click();
    assert.equal(await page.locator('#sk-ep').isVisible(),true);
    await page.locator('.sk-ep-x').click();
    assert.equal(await page.evaluate(()=>document.documentElement.style.overflow==='hidden'||document.body.classList.contains('dojo-dialog-open')),false);
    await page.screenshot({path:'artifacts/live/'+name+'.png'});
    // A reload must supply its own verified responses, including browser-cache responses.
    // Never let the preceding navigation's successful hashes satisfy this check.
    await page.evaluate(()=>scrollTo(0,0));
    loaded.clear();
    const reload=await page.reload({waitUntil:'domcontentloaded',timeout:30000});
    verifyHTML(await reload.text(),manifest,sha,rollback);
    await Promise.all(hashes);
    assert.deepEqual(byteFailures,[]);
    for(const key of assetKeys) assert.equal(loaded.get(key),manifest[key+'_sha256'],'Reload bytes mismatch: '+key);
    if (rollback || width>=500) assert.equal(await page.locator('#dojoVideo').getAttribute('src').then(Boolean),true);
    else {
      assert.equal(await page.locator('#dojoVideo').count(),0,'Reload must restore the lightweight facade');
      assert.equal(await page.locator('#dojoVideoFacade').isVisible(),true);
    }
    await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
    assert.equal(await page.locator('#sk-plan-chooser').isVisible(),true);
    await page.locator('.sk-plan-close').click();
    assert.deepEqual(errors,[]);
    result.hashes=Object.fromEntries(loaded);result.completed=true;
    await context.close();
  }
} finally {
  fs.writeFileSync('artifacts/live/results.json',JSON.stringify(results,null,2));
  clearTimeout(watchdog);
  await browser.close();
}
console.log('Ordinary homepage, campaign URL, browser bytes, interactions and reload verified for',sha);
