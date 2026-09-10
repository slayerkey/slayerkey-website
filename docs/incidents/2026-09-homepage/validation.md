# Repair validation

This page records validation of the review candidate. It is not evidence of deployment or cache recovery.

## Reproduce

Requires Node 22+, Python 3, PHP 8+, OpenSSL, and Playwright's Chromium/WebKit dependencies. On Windows the fixture uses Git for Windows' OpenSSL. The local fixture is HTTPS because the exact Header snapshot contains `upgrade-insecure-requests`. It combines the Header and Footer snapshots unchanged, Body with the two approved href corrections, and the plugin homepage/assets. PHP checks exercise real plugin functions against stubbed WordPress APIs; the fixture does not reproduce the complete WordPress database, theme, optimizer, or CDN.

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run test:unit
python3 tests/publish_test.py
npm run test:php
python3 tools/build_deploy.py --output build/php-check/plugin
php tests/wordpress.php build/php-check/plugin
npm test
npm run test:soak
npm run test:integration
python3 tools/build_rollback.py
node tools/rollback-smoke.mjs
```

The deterministic matrix blocks external traffic and intercepts Kit submissions. The integration command uses real networking and media from a local page, does not submit forms, and verifies actual playback by observing advancing video time. It records HAR waterfalls, CPU profiles, screenshots, long tasks, mutation counts, and warm-cache resource transfer sizes. Run performance scenarios sequentially to avoid CPU contention.

Attachment comparison confirmed Header and Body match the newly committed snapshots before the two Body href corrections. The committed Footer differs from the attachment only in its opening HTML comment (`Footer v17.0` versus `Footer SCRIPT v17.0`); its runtime is identical and left unchanged.

## Automated coverage

- Chromium and WebKit: 1440×900, 390×844, 430×932. The original 54-case matrix passed in both engines; 18 additional edge cases cover attribution, both real checkout navigation requests, failed preview images, hit testing, scroll/focus restoration, and document visibility changes. Initial WebKit failures were fixture transport errors caused by the supplied CSP; HTTPS corrected the environment. Scroll restoration is measured at the actual click, after browser scrolling/layout has completed.
- Authored section visibility and iframe source; sequential section-to-footer scrolling; chooser/proof open, close, Escape, focus return, scroll unlock; hero/final/pricing/footer navigation; native fallback with JavaScript disabled, blocked, or throwing; repeated initialization; failing PostHog capture; unavailable external analytics/media; reduced motion and offscreen/hidden-document review animation.
- Existing popup manual button, `#free-plan`, desktop exit intent, 30-second mobile timer, menu and chooser overlap, independent scroll locks, and intercepted submission to Kit form `9535572`. No subscriber was created. The supplied Footer reads dismissal suppression at page initialization; the soak dismisses then reloads to exercise repeated interactions without its one-time timer reopening mid-cycle. Timer behavior is checked separately.
- PHP rendering and responsive URL rewriting, public/private attribution, enqueue URLs, health tracking bytes, built manifest agreement, immutable build fingerprints, and unchanged authored source.
- Mock SFTP/HTTP publisher tests prove that staged corruption or stale public bytes cannot publish PHP and that public assets are verified before references. Ordinary HTML and browser-byte contract tests reject stale tracking even with a current manifest.
- The exact `601a2c09` tracking fixture triggers a mutation storm and starves its disconnect timer. A separate Node/CDP watchdog detects it without relying on the frozen renderer's timers.

## Five-minute soak

Local Chromium 390×844, repeated sequential scrolling, chooser, proof, and manual popup cycles; external media blocked to isolate custom runtime. Passed all assertions. The last sample was at 296.3 seconds of the completed five-minute loop.

| Measurement | Result |
| --- | --- |
| Retained DOM nodes | 1,675 throughout |
| Retained event listeners | 67 throughout |
| Heap growth after warm-up, forced GC samples | 117,348 bytes |
| Heartbeats at last sample | 1,185 |
| Largest 250ms heartbeat gap | 265.4ms |
| Observed DOM mutation records | 1,257, including initial document creation; no continuing storm |
| JavaScript animation-frame callbacks | 0 |
| Long tasks after warm-up | 0; no scrolling task above 100ms |
| Uncaught page errors | 0 |

[Raw soak samples](evidence/repair/soak.json). This bounds retained-growth behavior in the tested five-minute scenario; it does not prove an unlimited-session memory guarantee.

## Media and appearance

The final real-network fixture run passed all three 35-second sessions with zero uncaught page errors, advancing YouTube playback, no custom animation-frame callbacks, and no long tasks during the measured sequential scrolling windows. These are context-isolated runs within one browser process, not independent cold-machine benchmarks.

| Chromium scenario | DOMContentLoaded | Warm reload | Heartbeats / largest gap | Observer callbacks |
| --- | --- | --- | --- | --- |
| 1440×900 | 3.099s | 0.065s | 139 / 299.7ms | 6 |
| 390×844 | 0.281s | 0.041s | 140 / 266.9ms | 14 |
| 430×932, 4× CPU, 1.6 Mbps / 150ms | 2.451s | 1.124s | 137 / 533.5ms | 16 |

The throttled run still recorded initial page-load tasks up to 303ms and YouTube-frame tasks up to 267ms. Their duration is a remaining performance cost, not a mutation storm. Initial tasks labelled `unknown` by browser attribution are not assigned to a third party without evidence. The sequential scrolling windows contained no reported long tasks at all. Warm reload resource entries confirm zero transfer bytes for cached Dojo JS; these tests exercise real browser cache because the integration context uses no request routing.

See [integration results](evidence/repair/results.json), [desktop waterfall](evidence/repair/desktop.har), [throttled waterfall](evidence/repair/mobile430-slow4g-cpu4.har), and [throttled CPU profile](evidence/repair/mobile430-slow4g-cpu4.cpuprofile). Import HARs into browser network tooling and CPU profiles into Chromium's Performance profiler. Review screenshots: [desktop hero](evidence/repair/desktop-hero.png), [desktop chooser](evidence/repair/desktop-chooser.png), [mobile hero](evidence/repair/mobile390-hero.png), [mobile chooser](evidence/repair/mobile430-slow4g-cpu4-chooser.png), [original proof viewer](evidence/repair/desktop-proof.png), [mobile footer](evidence/repair/mobile390-footer.png).

All eight proof previews preserve the originals' aspect ratios and provide width/height plus 400px, 800px, and up-to-1200px responsive candidates. Eight 800px variants total 348,748 bytes compared with 5,497,229 original PNG bytes (93.7% smaller). The browser chooses a candidate based on display size and pixel density; this sum is not a claim about every page load's actual transferred bytes. Original PNG URLs remain the lightbox source.

The chooser uses the established pre-regression appearance and its final presentation-polish copy, authored once. It retains $19.99 monthly and $199.99 annual pricing and the same Whop plan IDs. Desktop screenshots were visually inspected for typography, layout, video presence, chooser controls, and proof rendering. Mobile screenshots and final real-network measurements are recorded alongside the integration evidence.

A separate real-player sound-control probe confirmed `muted: false`, volume 1, continued playback, and the enhancement button hidden after clicking. The prepared rollback also passed a 35-second local mobile smoke: both chooser links exactly matched pricing, proof and footer navigation worked, 139 heartbeats continued, and no page errors occurred. [Rollback result](evidence/repair/rollback-smoke.json).

## Remaining release checks and limits

- Live WPCode changes, asset publication, EasyWP/CDN clearing, and repeated ordinary-URL verification are pending release approval. Existing production diagnostic controls are not deployed fixes.
- Local real-network results differ from production WordPress/CDN delivery. Do not compare their fractional load timings as a controlled CDN performance benchmark. Read the HARs and separate YouTube/third-party loading from custom runtime responsiveness.
- Playwright WebKit is engine coverage, not a substitute for a physical iPhone/Safari check. Physical-phone playback and post-purge browsing remain release checks.
- Analytics navigation failure handling is tested; analytics ingestion and campaign reporting delivery are not established by these tests. The supplied external WPCode scripts remain outside the plugin's deployment ownership.
- The rollback restores the pinned pre-incident runtime's historical reveal/video dependencies and carousel cost. It is a temporary rollback option, not the same resilience level as the repair.

Follow the [release checklist](release.md); retain the resulting production artifacts before declaring recovery.
