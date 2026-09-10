import assert from 'node:assert/strict';

export async function verifyPlayback(page, timeout=45000) {
  const until=Date.now()+timeout;
  let first=null, last=null;
  while(Date.now()<until) {
    const frame=page.frames().find(f=>f.url().includes('youtube.com/embed/H7hYaHnT6ko'));
    try {
      last=await frame?.locator('video').evaluateAll(els=>els.map(v=>({time:v.currentTime,paused:v.paused,ready:v.readyState,error:v.error?.message})));
      const video=last?.find(v=>v.ready>=2&&!v.paused&&!v.error);
      if(video) {
        if(first===null) first=video.time;
        if(video.time-first>=1) return {first,last:video.time,advanced:video.time-first};
      }
    } catch { /* A loading frame can be replaced by YouTube. */ }
    await page.waitForTimeout(500);
  }
  assert.fail('YouTube did not demonstrate advancing playback: '+JSON.stringify(last));
}
