import { test, expect } from '@playwright/test';

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

test('direct Whop and Stripe checkouts emit checkout_started without changing navigation behavior', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.__posthogCaptures = [];
    window.posthog = {
      capture(event, properties) {
        window.__posthogCaptures.push({ event, properties });
      }
    };

    document.querySelector('[data-sk-location="pricing_monthly"]').addEventListener('click', event => {
      event.preventDefault();
    }, { once: true });

    const stripe = document.createElement('a');
    stripe.id = 'test-stripe-checkout';
    stripe.href = 'https://buy.stripe.com/test_checkout';
    stripe.setAttribute('data-sk-cta', 'test-stripe-buy');
    stripe.setAttribute('data-sk-offer', 'improvement_system');
    stripe.setAttribute('data-sk-location', 'test');
    stripe.addEventListener('click', event => event.preventDefault(), { once: true });
    document.body.appendChild(stripe);
  });

  await page.evaluate(() => {
    document.querySelector('[data-sk-location="pricing_monthly"]').click();
    document.querySelector('#test-stripe-checkout').click();
  });

  await expect.poll(async () => {
    return page.evaluate(() => window.__posthogCaptures.filter(item => item.event === 'checkout_started').length);
  }).toBe(2);

  const captured = await page.evaluate(() => window.__posthogCaptures.filter(item => item.event === 'checkout_started'));
  expect(captured[0].properties.provider).toBe('whop');
  expect(captured[0].properties.offer).toBe('dojo');
  expect(captured[0].properties.cta_location).toBe('pricing_monthly');
  expect(captured[0].properties.route).toBe('website');
  expect(captured[1].properties.provider).toBe('stripe');
  expect(captured[1].properties.offer).toBe('improvement_system');
  expect(captured[1].properties.cta_location).toBe('test');
  expect(captured[1].properties.route).toBe('website');
});

test('Dojo plan chooser preserves checkout analytics metadata', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.__posthogCaptures = [];
    window.posthog = {
      capture(event, properties) {
        window.__posthogCaptures.push({ event, properties });
      }
    };
  });

  await page.locator(hero).first().click();
  await expect(page.locator('#sk-plan-chooser')).toBeVisible();

  const chooser = page.locator('.sk-plan-action').first();
  await expect(chooser).toHaveAttribute('data-sk-offer', 'dojo');
  await expect(chooser).toHaveAttribute('data-sk-plan-direct', 'true');
  await expect(chooser).toHaveAttribute('data-sk-location', 'plan_chooser_monthly');

  await chooser.evaluate(element => {
    element.addEventListener('click', event => event.preventDefault(), { once: true });
    element.click();
  });

  await expect.poll(async () => {
    return page.evaluate(() => window.__posthogCaptures.filter(item => item.event === 'checkout_started').length);
  }).toBe(1);

  const captured = await page.evaluate(() => window.__posthogCaptures.find(item => item.event === 'checkout_started'));
  expect(captured.properties.provider).toBe('whop');
  expect(captured.properties.offer).toBe('dojo');
  expect(captured.properties.cta_location).toBe('plan_chooser_monthly');
});

test('GA4 begin_checkout maps every current paid offer and value', async ({ page }) => {
  await page.goto('/');
  const cases = [
    ['https://whop.com/checkout/plan_eVop6pXsIhHlf/', 19.99, 'plan_eVop6pXsIhHlf'],
    ['https://whop.com/checkout/plan_kaaoYadRlBi4n/', 199.99, 'plan_kaaoYadRlBi4n'],
    ['https://buy.stripe.com/28EbJ04MV4ege3j8VH04804', 249, 'stripe_system_249'],
    ['https://buy.stripe.com/00w28q3IR4eg8IZ8VH04806', 1200, 'stripe_coaching_full'],
    ['https://buy.stripe.com/4gM00i3IR4eg3oF0pb04805', 1300, 'stripe_coaching_plan']
  ];

  await page.evaluate(cases => {
    window.dataLayer.length = 0;
    cases.forEach(([href], index) => {
      const link = document.createElement('a');
      link.id = 'ga-checkout-' + index;
      link.className = 'btn';
      link.href = href;
      link.textContent = 'Checkout ' + index;
      link.addEventListener('click', event => event.preventDefault(), { once: true });
      document.body.appendChild(link);
    });
  }, cases);

  await page.evaluate(count => {
    for (let index = 0; index < count; index += 1) {
      document.querySelector('#ga-checkout-' + index).click();
    }
  }, cases.length);

  const events = await page.evaluate(() => window.dataLayer
    .map(entry => Array.from(entry))
    .filter(entry => entry[0] === 'event' && entry[1] === 'begin_checkout')
    .map(entry => entry[2]));

  expect(events).toHaveLength(cases.length);
  cases.forEach(([, value, itemId], index) => {
    expect(events[index].currency).toBe('USD');
    expect(events[index].value).toBe(value);
    expect(events[index].items[0].item_id).toBe(itemId);
    expect(events[index].items[0].price).toBe(value);
  });
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
  await page.evaluate(() => {
    window.__posthogCaptures = [];
    window.posthog = {
      capture(event, properties) {
        window.__posthogCaptures.push({ event, properties });
      }
    };
  });
  await page.locator('.sk-ep-input').fill('smoke@example.invalid');
  await page.locator('.sk-ep-btn').click();
  await expect(page.locator('#sk-ep-ok')).toBeVisible();
  expect(payload).toBe('email_address=smoke%40example.invalid');
  await expect.poll(async () => {
    return page.evaluate(() => window.__posthogCaptures.filter(item => item.event === 'lead_submitted').length);
  }).toBe(1);
  const captured = await page.evaluate(() => window.__posthogCaptures.find(item => item.event === 'lead_submitted'));
  expect(captured.properties.lead_magnet).toBe('30_day_rank_up_routine');
  expect(captured.properties.method).toBe('popup');
  expect(JSON.stringify(captured)).not.toContain('smoke@example.invalid');
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
