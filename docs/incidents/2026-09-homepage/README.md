# Homepage reliability incident and proposed repair

Status: review candidate, not deployed. The diagnosis below describes production responses captured during the incident. Local and CI repair tests do not establish production recovery.

## Cause and confidence

| Finding | Confidence | Evidence and practical implication |
| --- | --- | --- |
| Tracking's self-triggering MutationObserver freezes the renderer | Confirmed | A debugger pause in the production response landed in `updateLeadMagnetCopy()`. It unconditionally assigns the floating button's `textContent`; the document observer sees that write and calls it again. Its five-second disconnect timer cannot run. The exact historical fixture still reproduces the stall under an external watchdog. |
| Stale HTML and stable tracking URLs prolong the incident | Confirmed for captured responses | Ordinary `/` referenced `601a2c09`; the served tracking bytes exactly matched that commit. `X-Cache: HIT`, `Age: 46509`, and a different health deployment demonstrated disagreement between the HTML and health paths. A query variant returned another revision. The previous workflow could pass without verifying the browser's ordinary-URL asset bytes. |
| JavaScript-dependent rendering amplifies the symptoms | Confirmed | During the storm, the document stayed `loading`, `#dojoVideo` had no URL, and all 34 reveal elements remained transparent. The carousel had not started. |
| The chooser causes the primary freeze | Contradicted by isolation | Replacing only tracking restored the existing chooser and other interactions. The chooser still needed simpler initialization and native fallbacks. |
| Media payloads and continuous review animation contribute secondary cost | Supported, separate from the freeze | Original proof PNGs were large; throttled control media requests lasted tens of seconds. The old runtime continued scheduling animation frames. Neither explains the observed pre-DOMContentLoaded mutation loop. |
| ShortPixel, analytics DNS failures, or a memory leak caused this freeze | Not established | A ShortPixel redirect is not proof of faulty JavaScript transformation. Working controls also had third-party DNS failures. The baseline does not establish a retained-memory leak. |

## Regression timeline

All times below refer to commit history, not a proven edge-cache publication time.

- `0ff5f81f6337650e47b3d1a0e18e38117466f2e7`: tested pre-regression runtime; its tracking bytes are the working control.
- `601a2c097bb3d80179c5058567f47e87135624ca`, 2026-09-09 02:34:04 UTC: introduced the tracking text mutation loop. This is September 8, 19:34:04 in Phoenix.
- `460e07d08fc30f373635266e43b28dc364a290bc`: retained the faulty observer while coupling more behavior to the hash.
- `691a2e6d27dfbc9bf0b86f49556299cee7999429`: removed the observer.
- `c9ffb8c4b4a34ba32102cbe562786f2c6d4d0186`: reverted tracking to the earlier runtime.
- `400af33f6e743f0529129e118c3102246167eae6`: simplified Dojo behavior, but did not remove authored transparency or provide the native video URL.
- WPCode documentation commits followed. This branch starts from `e100cbde90bb5c21d3d031a519352d3880b73f14`, retaining those snapshots. No changes were made in the existing dirty checkout.

Bad tracking SHA-256: `02a9c8a0c2b2ad94c6c972f505b318f7c0d0210415e0dceb062da641ef2ab941`.

Working pre-regression tracking SHA-256: `e9017b212800d49b303644360eb00cd8bcc75f015a382e06847af0ee313c3f78`.

## Baseline and isolation measurements

These are diagnostic browser substitutions, **not deployed repairs**. Instrumentation adds overhead; compare the large causal difference, not fractional timing changes.

| Scenario | Broken ordinary production response | Only tracking replaced with pre-regression bytes |
| --- | --- | --- |
| Chromium 1440×900 | Uninstrumented DOMContentLoaded exceeded 30s; about 202,445 tracking observer callbacks in the instrumented window | DOMContentLoaded 1.70s; responsive for 35s |
| Chromium 390×844 | Still `loading` after ten seconds; about 205,293 tracking callbacks | DOMContentLoaded 1.45s; responsive for 35s |
| Chromium 430×932, 4× CPU | Same loop; about 21,389 tracking callbacks in the instrumented window | With an additional 1.6 Mbps / 150ms network throttle: DOMContentLoaded 8.54s; responsive for 36s; media still outstanding |

Desktop instrumented baseline recorded 809,841 callbacks across observers driven by the same storm, zero animation frames, and one heartbeat. The desktop control recorded 117 observer callbacks, 1,984 animation frames, and 2.487 seconds of task time over roughly 35 seconds. This distinguishes the freeze from the old carousel's avoidable ongoing work.

Original [baseline evidence](evidence/baseline/) includes JSON measurements, screenshots, CPU profiles, and HAR waterfalls. Published HAR copies omit response bodies, cookies, and request queries. Raw diagnostic originals remain in the local incident evidence directory. See [validation](validation.md) for measurements of the proposed repair.

## Repair behavior

The page's sales sections are visible in authored CSS, including an override of the global WPCode reveal defaults. The existing YouTube URL is authored on the iframe. Optional enhancement failures are isolated. Prices, checkout plan IDs, section order, and sales copy are retained.

The two-price chooser uses a single static template, one initialization, and real pricing anchors as its URL source. It only prevents a normal CTA click after opening succeeds. Header, hero, intermediate, final, and mobile CTAs have native `/#pricing` fallbacks. Modified clicks keep native behavior. No pending-click capture, document mutation observer, or unconditional animation-frame loop remains in the plugin runtime. Analytics exceptions are contained at the plugin's call boundary.

Proof thumbnails use dimensioned responsive WebP copies; original PNG URLs remain the lightbox source. Visibility never waits for image loading. Reviews use the existing CSS animation, paused offscreen or when hidden and disabled for reduced motion. Chooser and proof use independent, idempotent close behavior without overwriting WPCode's HTML scroll lock.

The supplied Header and Footer snapshots remain unchanged. The Body snapshot contains exactly two href corrections. Kit form `9535572`, the lead magnet, manual/hash/exit/mobile popup triggers, and popup copy remain intact. The snapshots in Git are preparation, not live WPCode updates.

## Delivery changes

The additive manifest fields `tracking_js` and `tracking_js_sha256` fingerprint tracking alongside Dojo JS/CSS. PHP enqueues and health output identify the actual tracking URL and bytes. The publisher stages and downloads the full release for byte verification, uploads assets without deleting earlier hashes, verifies immutable public URLs, then publishes HTML/PHP references and checks their SFTP bytes.

Deployment is serialized and no longer cancelled mid-upload. Documentation changes cannot trigger deployment. Browser verification follows publication; it checks ordinary HTML, a YouTube campaign URL, actual browser response hashes, interactions, real playback, and reloads. Stale HTML or tracking bytes fail even when health or a cache-busted URL looks current. An hourly production smoke uses the latest deployment workflow's actual head SHA and shares deployment concurrency.

Release and rollback require the [runbook](release.md). No production recovery claim should precede repeated ordinary-URL passes after cache clearing.
