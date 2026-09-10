import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
process.env.FIXTURE_PLUGIN ||= 'build/rollback/plugin';
const { startServer }=await import('./fixture-server.mjs');
const server=await startServer(4176),browser=await chromium.launch();
const watchdog=setTimeout(()=>{console.error('Rollback external watchdog');process.exit(1)},60000);
const result={revision:'0ff5f81f6337650e47b3d1a0e18e38117466f2e7',completed:false,errors:[]};
try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await context.addInitScript(()=>{window.__beats=0;setInterval(()=>window.__beats++,250)});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
  const began=Date.now();await page.goto('https://127.0.0.1:4176/');
  result.dclMs=Date.now()-began;
  await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
  assert.equal(await page.locator('#sk-plan-chooser').isVisible(),true);
  result.checkoutURLs=await page.locator('.sk-plan-action').evaluateAll(els=>els.map(e=>e.href));
  assert.ok(result.checkoutURLs[0].includes('plan_eVop6pXsIhHlf'));
  assert.ok(result.checkoutURLs[1].includes('plan_kaaoYadRlBi4n'));
  for(const [index,plan] of ['monthly','annual'].entries())
    assert.equal(result.checkoutURLs[index],await page.locator('[data-sk-location="pricing_'+plan+'"]').getAttribute('href'));
  await page.locator('.sk-plan-close').click();
  await page.locator('[data-proof-src]').first().click();
  await page.locator('.dj-lightbox-close').click();
  await page.locator('footer.sk-footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(Math.max(0,35000-(Date.now()-began)));
  if(await page.locator('#sk-ep').isVisible()) await page.locator('.sk-ep-x').click();
  result.beats=await page.evaluate(()=>window.__beats);
  assert.ok(result.beats>125);
  assert.ok(await page.locator('#dojoVideo').getAttribute('src'));
  assert.deepEqual(result.errors,[]);
  result.completed=true;
} finally {
  fs.writeFileSync('artifacts/rollback-smoke.json',JSON.stringify(result,null,2));
  clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));
}
console.log(JSON.stringify(result));
