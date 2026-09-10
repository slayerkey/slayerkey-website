# Mobile performance notes

Date: 2026-09-10
Branch: `perf/mobile-pagespeed`

## Diagnosis

The supplied PageSpeed result was about 48 on mobile. A fresh three-run production Lighthouse sample was similarly volatile (42-57, median 56), while desktop remained strong (median 87).

Ranked findings:

1. The hero VSL loaded an autoplaying YouTube iframe during initial navigation. It immediately fetched the player document, a roughly 484 KB player script, APIs, captions, and video media. This was the largest safely removable mobile cost and also created substantial third-party main-thread work.
2. Production HTML delivery was slow. A throttled DevTools trace measured about 2.48 s TTFB, accounting for 53% of a 4.65 s LCP. The document was already compressed, but the response was dynamic/uncached. This branch deliberately does not change WordPress, origin, or Cloudflare caching.
3. Whop scripts were the largest remaining third-party main-thread cost. One production trace attributed about 562 ms to Whop; Lighthouse samples showed `s.js` and `sc.js` could consume substantially more under contention. Checkout and tracking behavior were kept unchanged.
4. Four below-fold proof images were natively lazy loaded, but browsers still fetched them near the initial viewport. At high mobile DPR the old 400/800/1200 candidate set selected 1200px files for 320px rendered images. Lighthouse estimated about 123 KB of avoidable transfer in the tested DPR-3 profile.
5. CLS was already excellent (roughly 0.0004-0.0022 in production samples). Images already had intrinsic dimensions, so no layout redesign was warranted.
6. Lower-impact opportunities included about 21 KB of unused LifterLMS CSS, PostHog unused/legacy JavaScript and a forced reflow, two Google font families, and an oversized but small 6.8 KB header avatar. These were not changed because savings were smaller or behavior risk was higher.

The production LCP element was the `400 RR` hero text. INP is a field metric and was not available from these lab runs; TBT is reported as the lab responsiveness proxy.

## Changes

- On mobile, replaced the initial YouTube iframe with an accessible, layout-stable facade using the same video thumbnail and visible player area.
- Stored the thumbnail with the plugin and marked it high priority, avoiding an extra YouTube connection on the initial render.
- Desktop retains its existing muted autoplay behavior. On mobile, the iframe automatically starts muted once scrolling brings at least 80% of the VSL into view; tapping the facade first starts it immediately with sound (`mute=0`). Modified clicks and JavaScript failure retain a normal YouTube watch-page link.
- Added 600px, 960px, and where useful 1080px WebP proof variants; corrected `sizes` to the rendered mobile width. Native lazy loading and intrinsic dimensions remain intact.
- Updated release verification, live verification, integration checks, PHP checks, and browser tests so a pre-interaction iframe is treated as a regression.

Tradeoff: mobile autoplay begins when the visitor scrolls the VSL substantially into view instead of during the initial network waterfall. Desktop behavior is unchanged. Browser autoplay policies still require automatic playback to begin muted; the existing click-for-sound affordance remains.

## Measurements

All controlled comparisons used the same local HTTPS fixture, Brave/Chromium, and Lighthouse version. Mobile numbers are medians of three runs at 390x844, DPR 3, simulated throttling. Raw reports are in ignored `artifacts/performance/` files and are not part of the deploy artifact.

### Mobile controlled comparison

| Metric | `origin/main` before | Candidate after | Change |
|---|---:|---:|---:|
| Performance score | 60 | 76 | +16 |
| FCP | 2.938 s | 2.065 s | -0.873 s |
| LCP | 3.310 s | 2.857 s | -0.453 s |
| TBT | 1.736 s | 0.743 s | -0.993 s |
| CLS | 0.0033 | 0.0052 | +0.0019; still excellent |
| Speed Index | 2.938 s | 2.065 s | -0.873 s |
| Transfer | 2.533 MB | 0.595 MB | -1.938 MB (-77%) |
| Main-thread work | 3.897 s | 2.827 s | -1.070 s |

The three final mobile scores were 75, 76, and 76. A production after score is intentionally unavailable because this branch has not been deployed.

### Desktop controlled comparison

| Metric | `origin/main` before | Candidate after | Change |
|---|---:|---:|---:|
| Performance score | 97 | 98 | +1; within run variance |
| FCP | 0.593 s | 0.596 s | +0.003 s |
| LCP | 1.098 s | 1.055 s | -0.043 s |
| TBT | 0.107 s | 0.082 s | -0.025 s |
| CLS | 0.0029 | 0.0021 | -0.0008 |
| Speed Index | 0.757 s | 0.764 s | +0.007 s |
| Transfer | 2.295 MB | 2.241 MB | -0.054 MB |

The fresh production desktop median before changes was 87 (FCP 1.131 s, LCP 1.148 s, TBT 0.220 s, CLS 0.0017, Speed Index 1.377 s). Production after metrics must be collected after an approved deployment.

## Validation

- Unit/build contract: 4 passed.
- Publish tests: 2 passed.
- WordPress PHP rendering checks: passed for source and built plugin using checksum-verified portable PHP 8.5.10.
- Browser matrix: 78 passed across Chromium and WebKit at desktop, 390px, and 430px.
- Soak test: passed; node and listener counts remained flat.
- Real-network media integration: passed on desktop, mobile 390, and mobile 430 under Slow 4G/4x CPU; mobile autoplay advanced after the in-view trigger.
- Local Lighthouse accessibility: 86 and best practices: 96. Remaining accessibility findings were pre-existing fixture/document issues; the facade-specific label mismatch was corrected.

The Lighthouse CLI emitted a Windows temporary-profile cleanup `EPERM` after saving each valid report. Reports were present and parsed successfully.

## Remaining opportunities

1. High impact: investigate the roughly 2.4 s production document TTFB with hosting/WordPress expertise and staged cache validation. This requires separate approval because Cloudflare/server changes were excluded.
2. High-to-medium impact: ask Whop whether its tracking/checkout loader can be delayed or reduced without losing attribution or checkout behavior. Do not change it without conversion and analytics validation.
3. Medium impact: test homepage-only dequeue of unused LifterLMS CSS and unrelated jQuery UI assets in staging. Handle names and WPCode dependencies must be proven first.
4. Low-to-medium impact: review PostHog bundle configuration and forced reflow only if identical capture, replay, surveys, and attribution can be demonstrated.
5. Low impact: consolidate font requests and provide a smaller header avatar through the WordPress media layer.
