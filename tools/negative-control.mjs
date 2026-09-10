// Executed in a separate process: the historical microtask loop must never hang the test runner.
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch();
const page=await browser.newPage();
const cdp=await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
await page.goto('about:blank');
await page.evaluate(()=>{
  window.__negative={records:0,timerFired:false};
  new MutationObserver(records=>window.__negative.records+=records.length).observe(document,{childList:true,subtree:true});
  setTimeout(()=>window.__negative.timerFired=true,5000);
});
const old=fs.readFileSync('tests/fixtures/tracking-601a2c09.js','utf8');
// Intentionally do not await a renderer whose DOMContentLoaded is about to be starved.
page.setContent('<a class="sk-fp-float" data-ep-open>Free Improvement Plan</a><script>'+old+'</script>',
  {timeout:15000}).catch(()=>{});
await new Promise(r=>setTimeout(r,7000));
const paused=new Promise(r=>cdp.once('Debugger.paused',r));
await cdp.send('Debugger.pause');
const pause=await paused;
const result=await cdp.send('Debugger.evaluateOnCallFrame',{
  callFrameId:pause.callFrames[0].callFrameId,expression:'JSON.stringify(window.__negative)',returnByValue:true
});
console.log(result.result.value);
await browser.close();
