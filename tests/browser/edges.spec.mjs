import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
});

test('campaign attribution and both chooser checkouts use the existing pricing destinations', async ({ page, context }) => {
  const campaign='/?utm_source=youtube&utm_medium=video&utm_campaign=guide&utm_content=description';
  await page.goto(campaign);
  await page.locator('#sk-std [data-sk-checkout="true"]').first().click();
  const destinations=['plan_eVop6pXsIhHlf','plan_kaaoYadRlBi4n'];
  for (const [index,plan] of ['monthly','annual'].entries()) {
    const original=await page.locator('[data-sk-location="pricing_'+plan+'"]').getAttribute('href');
    const link=page.locator('.sk-plan-action').nth(index);
    expect(await link.getAttribute('href')).toBe(original);
    const url=new URL(original);
    expect(url.pathname).toBe('/checkout/'+destinations[index]+'/');
    expect(Object.fromEntries(url.searchParams)).toEqual({utm_source:'youtube',utm_medium:'video',utm_campaign:'guide',utm_content:'description'});
    const navigation=context.waitForEvent('request',{predicate:r=>r.url()===url.href});
    await link.click();
    await navigation;
    for (const popup of context.pages().filter(p=>p!==page)) await popup.close();
  }
});

test('failed preview images and blocked YouTube never hide copy or trap scrolling', async ({ page }) => {
  await page.route('**/assets/proof/**',r=>r.abort());
  await page.goto('/');
  await expect(page.locator('#dojoVideo')).toHaveAttribute('src',/youtube.com\/embed\//);
  for(const section of await page.locator('#sk-std section').all()) {
    await section.scrollIntoViewIfNeeded();
    expect(await section.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(0);
  }
  expect(await page.locator('#sk-std .reveal').evaluateAll(els=>els.every(e=>getComputedStyle(e).opacity==='1'))).toBe(true);
  for(const trigger of [page.locator('#sk-std [data-sk-checkout="true"]').last(),page.locator('[data-proof-src]').first()]) {
    await trigger.scrollIntoViewIfNeeded();
    // The browser may finish lazy-image layout while Playwright brings a target into view.
    // Capture the position at the real interaction, before the dialog's bubble handler.
    await trigger.evaluate(el=>el.addEventListener('click',()=>{window.__scrollAtOpen=scrollY},{capture:true,once:true}));
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(()=>Math.abs(scrollY-window.__scrollAtOpen))).toBeLessThan(3);
    expect(await trigger.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true);
    await page.evaluate(()=>scrollBy(0,150));
    expect(await page.evaluate(()=>document.body.classList.contains('dojo-dialog-open'))).toBe(false);
  }
});

test('hidden documents pause reviews and returning documents resume them', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dj-review-rail').scrollIntoViewIfNeeded();
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-play-state','running');
  // Explicitly exercise lifecycle dispatch in both engines; headless focus alone is not visibility.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-play-state','paused');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-play-state','running');
});
