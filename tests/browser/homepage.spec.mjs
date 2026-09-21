import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const checkout = plan => '[data-sk-location="pricing_' + plan + '"]';
const hero = '#sk-std [data-sk-checkout="true"]:not([data-sk-plan-direct])';
const expectedCheckoutPlans = {
  monthly: 'plan_eVop6pXsIhHlf',
  annual: 'plan_kaaoYadRlBi4n'
};
async function unlockCheck(page) {
  await expect(page.locator('body')).not.toHaveClass(/dojo-dialog-open/);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
}
async function readable(page) {
  expect(await page.locator('#sk-std .reveal').evaluateAll(elements => elements.filter(el =>
    getComputedStyle(el).opacity !== '1' || el.getBoundingClientRect().height === 0
  ).map(el => el.className))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect.poll(()=>page.evaluate(() => {
    const facade=document.getElementById('dojoVideoFacade'), iframe=document.getElementById('dojoVideo');
    return facade ? /youtube\.com\/watch\?v=H7hYaHnT6ko/.test(facade.href) :
      !!iframe && /youtube\.com\/embed\/H7hYaHnT6ko\?autoplay=1&mute=1/.test(iframe.src);
  })).toBe(true);
}
test.beforeEach(async ({ context }) => {
  // Local regressions are deterministic and never create leads, checkouts or analytics traffic.
  await context.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
});

test('native content, section scrolling, chooser, proof, footer, and reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await readable(page);
  for (const section of await page.locator('#sk-std section').all()) {
    await section.scrollIntoViewIfNeeded();
    expect(await section.evaluate(el => el.textContent.trim().length)).toBeGreaterThan(20);
  }
  await page.locator('footer.sk-footer').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.locator(hero).first().click();
  await expect(page.locator('#sk-plan-chooser')).toBeVisible();
  for (const [index, plan] of ['monthly', 'annual'].entries()) {
    expect(await page.locator('.sk-plan-action').nth(index).getAttribute('href'))
      .toBe(await page.locator(checkout(plan)).getAttribute('href'));
  }
  await page.locator('.sk-plan-close').click();
  await unlockCheck(page);
  await page.locator('[data-proof-src]').first().click();
  await expect(page.locator('#djLightbox')).toBeVisible();
  await expect(page.locator('#djLightbox img')).toHaveAttribute('src', /^https:\/\/slayerkey.com\/wp-content\/uploads\/.+\.png$/);
  await expect(page.locator('.dj-lightbox-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#djLightbox')).toBeHidden();
  await unlockCheck(page);
  await expect(page.locator('[data-proof-src]').first()).toBeFocused();
  const footerLink = page.locator('footer.sk-footer a[href="/"]');
  await footerLink.scrollIntoViewIfNeeded();
  await expect(footerLink).toBeVisible();
  await footerLink.click();
  await readable(page);
  await page.reload();
  await readable(page);
  expect(errors).toEqual([]);
});

for (const fault of ['disabled', 'blocked', 'throws']) {
  test('sales content and navigation survive JavaScript ' + fault, async ({ browser, context, page, viewport, isMobile }) => {
    let owned;
    if (fault === 'disabled') {
      owned = await browser.newContext({ viewport, isMobile, javaScriptEnabled:false, ignoreHTTPSErrors:true });
      await owned.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
      page = await owned.newPage();
    } else {
      await page.route('**/dojo.js', r => fault === 'blocked' ? r.abort() :
        r.fulfill({contentType:'text/javascript',body:'throw new Error("injected Dojo failure")'}));
    }
    await page.goto('/');
    await readable(page);
    await expect(page.locator('#dojoVideoFacade')).toBeVisible();
    await page.locator(hero).first().click();
    await expect(page).toHaveURL(/#pricing$/);
    await expect(page.locator(checkout('monthly'))).toBeVisible();
    for (const selector of ['.sk-cta-btn', hero + ':last-child']) {
      if (await page.locator(selector).count()) {
        expect(await page.locator(selector).first().getAttribute('href')).toMatch(/#pricing$/);
      }
    }
    // In failure-mode tests, validate the native checkout destinations without
    // actually navigating away. Aborted external navigation is flaky in WebKit
    // and does not add coverage beyond proving the real anchors are present.
    for (const [plan, planId] of Object.entries(expectedCheckoutPlans)) {
      const link = page.locator(checkout(plan));
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      expect(new URL(href, 'https://slayerkey.com').pathname).toBe('/checkout/' + planId + '/');
    }
    await owned?.close();
  });
}

test('missing chooser or checkout preserves pricing fallback; modified clicks stay native', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.querySelector('#sk-plan-chooser').remove());
  await page.locator(hero).first().click();
  await expect(page).toHaveURL(/#pricing$/);
  await unlockCheck(page);
  await page.reload();
  const prevented = await page.locator(hero).first().evaluate(el =>
    !el.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true,ctrlKey:true,button:0})));
  expect(prevented).toBe(false);
});

test('video preserves desktop autoplay and defers mobile YouTube until interaction', async ({ page, isMobile }) => {
  const requests=[];
  page.on('request',request=>{if(request.url().includes('youtube.com/embed/H7hYaHnT6ko'))requests.push(request.url())});
  await page.goto('/');
  if (isMobile) {
    expect(requests).toEqual([]);
    const facade=page.locator('#dojoVideoFacade');
    await expect(facade).toHaveAccessibleName("Click for sound. Play Slayerkey's Training Dojo video");
    await facade.click();
    await expect(page.locator('#dojoVideo')).toHaveAttribute('src',/youtube.com\/embed\/H7hYaHnT6ko\?autoplay=1&mute=0/);
    await page.evaluate(()=>scrollTo(0,0));
    await page.reload();
    await page.evaluate(()=>scrollBy(0,1));
    await page.waitForTimeout(50);
    if (await page.locator('#dojoVideoFacade').count())
      await page.evaluate(()=>document.getElementById('dojoVideoFacade').scrollIntoView({block:'center'}));
    await expect(page.locator('#dojoVideo')).toHaveAttribute('src',/youtube.com\/embed\/H7hYaHnT6ko\?autoplay=1&mute=1/);
    await expect(page.locator('#unmuteBtn')).toBeVisible();
  } else {
    await expect(page.locator('#dojoVideo')).toHaveAttribute('src',/youtube.com\/embed\/H7hYaHnT6ko\?autoplay=1&mute=1/);
    await expect(page.locator('#unmuteBtn')).toBeVisible();
  }
  await expect.poll(()=>requests.length).toBeGreaterThan(0);
});

test('repeat initialization and failing analytics cannot break checkout navigation', async ({ page }) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(() => { window.posthog={capture(){throw new Error('analytics unavailable')}}; });
  await page.goto('/');
  await page.addScriptTag({url:'/wp-content/plugins/slayerkey-website/previews/dojo-v3/dojo.js'});
  await page.addScriptTag({url:'/wp-content/plugins/slayerkey-website/assets/js/tracking.js'});
  expect(await page.locator('#sk-plan-chooser').count()).toBe(1);
  await page.locator(hero).first().click();
  await expect(page.locator('#sk-plan-chooser')).toBeVisible();
  await page.keyboard.press('Escape');
  await unlockCheck(page);
  const requests=[]; page.context().on('request',r=>{if(r.url().includes('whop.com/checkout'))requests.push(r.url())});
  await page.locator(checkout('monthly')).click();
  await expect.poll(()=>requests.length).toBeGreaterThan(0);
  expect(requests[0]).toContain('plan_eVop6pXsIhHlf');
  expect(errors).toEqual([]);
});

test('popup manual/hash/timer/exit paths and overlapping dialogs retain independent locks', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.locator('.sk-fp-float').click();
  await expect(page.locator('#sk-ep')).toBeVisible();
  await page.locator('.sk-ep-x').click();
  await unlockCheck(page);
  await page.evaluate(() => { location.hash='free-plan'; });
  await expect(page.locator('#sk-ep')).toBeVisible();
  await page.keyboard.press('Escape');
  await unlockCheck(page);
  await page.locator(hero).first().click();
  await page.evaluate(() => window.SK_openFreePlan());
  await page.locator('.sk-plan-close').click();
  await expect(page.locator('#sk-ep')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).toBe('hidden');
  await page.locator('.sk-ep-x').click();
  await unlockCheck(page);
  if (isMobile) {
    const burger = page.locator('#sk-burger');
    await burger.scrollIntoViewIfNeeded();
    await expect(burger).toBeVisible();
    await burger.click();
    await expect(page.locator('#sk-mobile')).toBeVisible();
    await page.locator('.sk-mobile-cta').click();
    await expect(page.locator('#sk-mobile')).toBeHidden();
    await expect(page.locator('#sk-plan-chooser')).toBeVisible();
    await page.locator('.sk-plan-close').click();
    await unlockCheck(page);
  }
  // Real timer coverage is in the 35-second responsiveness test.
});

test('Kit submission uses the existing form and endpoint, without creating a subscriber', async ({ page }) => {
  let payload;
  await page.route('https://app.convertkit.com/forms/9535572/subscriptions', route => {
    payload=route.request().postData();
    return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:''});
  });
  await page.goto('/#free-plan');
  await page.locator('.sk-ep-input').fill('smoke@example.invalid');
  await page.locator('.sk-ep-btn').click();
  await expect(page.locator('#sk-ep-ok')).toBeVisible();
  expect(payload).toBe('email_address=smoke%40example.invalid');
  await expect(page.locator('#sk-ep')).toBeHidden({timeout:6000});
  await unlockCheck(page);
});

test('35-second heartbeat, native image dimensions, animation lifecycle, and automatic popup', async ({ page, isMobile }, info) => {
  await page.addInitScript(() => {
    window.__heartbeat=0; setInterval(()=>window.__heartbeat++,250);
    window.__longTasks=[];
    if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
      new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask'});
  });
  await page.goto('/');
  await readable(page);
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-play-state','paused');
  await page.locator('.dj-review-rail').scrollIntoViewIfNeeded();
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-play-state','running');
  await page.locator('header.sk-header').scrollIntoViewIfNeeded();
  await page.evaluate(()=>scrollTo(0,0));
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-play-state','paused');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.dj-review-track')).toHaveCSS('animation-name','none');
  for (const img of await page.locator('#sk-std [data-proof-src] img').all()) {
    expect(Number(await img.getAttribute('width'))).toBeGreaterThan(0);
    expect(await img.getAttribute('srcset')).toContain('400w');
  }
  await page.waitForTimeout(35000);
  expect(await page.evaluate(()=>window.__heartbeat)).toBeGreaterThan(125);
  if (isMobile) await expect(page.locator('#sk-ep')).toBeVisible();
  else {
    await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseleave',{clientY:0})));
    await expect(page.locator('#sk-ep')).toBeVisible();
  }
  await page.locator('.sk-ep-x').click();
  await unlockCheck(page);
  await readable(page);
  await info.attach('runtime', {body:JSON.stringify(await page.evaluate(()=>({heartbeats:window.__heartbeat,longTasks:window.__longTasks}))),contentType:'application/json'});
});


test('Performance Accelerator coaching page preserves the funnel and responsive offer card', async ({ page }) => {
  const cal = 'https://cal.com/slayerkey/perf-accelerator-application';
  const source = fs.readFileSync(
    new URL('../../wordpress/slayerkey-website/previews/live-refresh/coaching-live-refresh-v3/index.html', import.meta.url),
    'utf8'
  );
  // Static markup/CSS verification is deterministic and avoids executing the captured
  // production scripts while still exercising every configured desktop/mobile viewport.
  const html = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  for (const selector of ['#hero', '#showcase', '#psmr', '#coaching-pricing', '#proof-wall', '#how', '#reviews', '#about', '#faq', '#final-cta']) {
    await expect(page.locator(selector)).toHaveCount(1);
  }

  const bodyText = await page.locator('body').innerText();
  for (const stale of [
    'Private Mentorship',
    'Performance Mentorship',
    'four-month',
    '4 months',
    '$1,200',
    '$325',
    'Start Your Mentorship',
    'Apply for Mentorship'
  ]) {
    expect(bodyText).not.toContain(stale);
  }

  await expect(page.locator('#coaching-pricing h2')).toHaveText('Slayerkey Performance Accelerator');
  await expect(page.locator('#coaching-pricing')).toContainText('Three months of personalized coaching');
  await expect(page.locator('#coaching-pricing')).toContainText('8 private 1:1 coaching sessions');
  await expect(page.locator('#coaching-pricing')).toContainText("Slayerkey's Improvement System included at no additional cost");
  await expect(page.locator('#how')).toContainText('Diagnose');
  await expect(page.locator('#how')).toContainText('Prioritize');
  await expect(page.locator('#how')).toContainText('Implement');
  await expect(page.locator('#how')).toContainText('Adjust');

  expect(await page.locator('a[href*="buy.stripe.com"]').count()).toBe(0);
  expect(await page.locator('#final-cta [data-ep-open]').count()).toBe(0);

  const applies = page.locator('a[data-sk-cta="performance_accelerator_apply"]');
  await expect(applies).toHaveCount(9);
  for (const link of await applies.all()) {
    expect(await link.getAttribute('href')).toBe(cal);
    expect(await link.getAttribute('data-sk-offer')).toBe('performance_accelerator');
    expect(await link.getAttribute('data-sk-location')).toBeTruthy();
  }

  const offer = page.locator('#coaching-pricing');
  expect(await offer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const card = await page.locator('#coaching-pricing .price-card').boundingBox();
  const apply = await page.locator('#coaching-pricing [data-sk-cta="performance_accelerator_apply"]').boundingBox();
  const viewport = page.viewportSize();
  expect(card).not.toBeNull();
  expect(apply).not.toBeNull();
  expect(card.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(apply.width).toBeLessThanOrEqual(viewport.width + 1);
});
