import { chromium } from 'playwright';

const url = 'https://slayerkey.com/coaching/?utm_source=youtube&utm_medium=description&utm_campaign=mentorship_test&utm_content=hero_cta&debug=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2200);

const desktop = await page.evaluate(() => {
  const qs = s => document.querySelector(s);
  const qsa = s => [...document.querySelectorAll(s)];
  const checkoutLinks = qsa('a[href*="buy.stripe.com"]');
  const base = h => h.split('?')[0];
  return {
    liveMarker: qs('meta[name="slayerkey-live-page"]')?.content || '',
    candidateMarker: qs('meta[name="slayerkey-candidate"]')?.content || '',
    heading: qs('#sk-wb h1')?.innerText || '',
    checkoutCount: checkoutLinks.length,
    checkoutLinks: checkoutLinks.map(a => ({ href: a.href, target: a.target, text: a.textContent.trim(), base: base(a.href) })),
    hasGtag: typeof window.gtag === 'function',
    hasPosthog: !!window.posthog && typeof window.posthog.capture === 'function',
    hasClarity: typeof window.clarity === 'function',
    overflow: document.documentElement.scrollWidth - innerWidth,
    pricingRects: qsa('#coaching-pricing .price-card').map(e => ({ top: e.getBoundingClientRect().top, width: e.getBoundingClientRect().width })),
    staleCheckout: document.documentElement.innerHTML.includes('ko-fi.com/s/cd324493ce') || document.documentElement.innerHTML.includes('whop.com/checkout/plan_TOSvOOLdpQXzi')
  };
});

if (desktop.liveMarker !== 'coaching-live-refresh-v3') throw new Error('Production marker missing: ' + JSON.stringify(desktop));
if (desktop.candidateMarker) throw new Error('Candidate marker leaked onto production route');
if (desktop.checkoutCount < 2) throw new Error('Expected both Stripe checkout options');
if (!desktop.hasGtag || !desktop.hasPosthog || !desktop.hasClarity) throw new Error('Analytics foundation missing: ' + JSON.stringify(desktop));
if (desktop.overflow > 2) throw new Error('Desktop horizontal overflow: ' + desktop.overflow);
if (desktop.pricingRects.length !== 2 || Math.abs(desktop.pricingRects[0].top - desktop.pricingRects[1].top) > 2) throw new Error('Desktop pricing cards not side by side');
if (desktop.staleCheckout) throw new Error('Legacy checkout destination remains in production HTML');

const expectedBases = [
  'https://buy.stripe.com/00w28q3IR4eg8IZ8VH04806',
  'https://buy.stripe.com/4gM00i3IR4eg3oF0pb04805'
];
for (const base of expectedBases) {
  const item = desktop.checkoutLinks.find(x => x.base === base);
  if (!item) throw new Error('Missing checkout link ' + base);
  const u = new URL(item.href);
  for (const [k,v] of Object.entries({utm_source:'youtube',utm_medium:'description',utm_campaign:'mentorship_test',utm_content:'hero_cta'})) {
    if (u.searchParams.get(k) !== v) throw new Error(`UTM ${k} missing on ${base}: ${item.href}`);
  }
  if (item.target === '_blank') throw new Error('Stripe checkout unexpectedly opens new tab: ' + base);
}

async function testCheckout(match, expectedValue) {
  return await page.evaluate(({ match, expectedValue }) => {
    const a = [...document.querySelectorAll('a[href]')].find(el => el.href.includes(match));
    if (!a) throw new Error('Checkout anchor not found in page');
    window.__phCheckoutCalls = [];
    if (window.posthog) {
      window.posthog.capture = function(name, props) { window.__phCheckoutCalls.push({ name, props }); };
    }
    const before = (window.dataLayer || []).length;
    a.addEventListener('click', e => e.preventDefault(), { once: true });
    a.click();
    const rows = (window.dataLayer || []).slice(before).map(x => Array.from(x));
    const ga = rows.filter(x => x[0] === 'event' && x[1] === 'begin_checkout').map(x => x[2]);
    const ph = window.__phCheckoutCalls.filter(x => x.name === 'begin_checkout').map(x => x.props);
    return { ga, ph, expectedValue };
  }, { match, expectedValue });
}

const oneTime = await testCheckout('00w28q3IR4eg8IZ8VH04806', 1200);
if (!oneTime.ga.some(x => x && x.value === 1200)) throw new Error('GA4 one-time begin_checkout $1200 missing: ' + JSON.stringify(oneTime));
if (!oneTime.ph.some(x => x && x.value === 1200)) throw new Error('PostHog one-time begin_checkout $1200 missing: ' + JSON.stringify(oneTime));

const monthly = await testCheckout('4gM00i3IR4eg3oF0pb04805', 1300);
if (!monthly.ga.some(x => x && x.value === 1300)) throw new Error('GA4 monthly begin_checkout $1300 missing: ' + JSON.stringify(monthly));
if (!monthly.ph.some(x => x && x.value === 1300)) throw new Error('PostHog monthly begin_checkout $1300 missing: ' + JSON.stringify(monthly));

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1400);
const mobile = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - innerWidth,
  cardWidths: [...document.querySelectorAll('#coaching-pricing .price-card')].map(e => e.getBoundingClientRect().width),
  marker: document.querySelector('meta[name="slayerkey-live-page"]')?.content || ''
}));
if (mobile.marker !== 'coaching-live-refresh-v3') throw new Error('Mobile production marker missing');
if (mobile.overflow > 2) throw new Error('Mobile horizontal overflow: ' + mobile.overflow);
if (mobile.cardWidths.some(w => w > 390)) throw new Error('Mobile pricing card overflow: ' + mobile.cardWidths.join(','));
if (pageErrors.length) throw new Error('Page JS errors: ' + pageErrors.join(' | '));

console.log(JSON.stringify({ desktop, oneTime, monthly, mobile }, null, 2));
await browser.close();
