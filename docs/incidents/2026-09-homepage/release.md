# Release and rollback checklist

## Review boundary

This PR prepares code, WPCode corrections, verification and rollback artifacts. It does not authorize this agent to merge, deploy, change live WPCode, or clear production caches before release approval. Merging a production change to `main` starts the deployment workflow; schedule the cache-clearing operator before merging.

## Release after approval

1. Confirm the reviewed commit, green reliability checks, local media integration evidence, five-minute soak, and available SFTP credentials in GitHub Actions. Record the existing live WPCode Body and release SHA for rollback.
2. In WPCode Body, apply only the two changes shown in [the snapshot diff](../../wordpress/wpcode/body.html): header `.sk-cta-btn` and mobile `.sk-mobile-cta` become `href="/#pricing"`. Keep their labels, markup, and all Header/Footer scripts unchanged. Do not replace Kit form `9535572` or create a test subscriber.
3. Merge the approved branch. The workflow runs tests, builds `release-<full SHA>`, and uploads/verifies immutable assets before publishing PHP. Do not cancel the upload. Earlier hashed files are intentionally retained; do not run a destructive mirror or cleanup of cached references during this release.
4. Once publication reaches browser verification, clear EasyWP's page cache using the WordPress dashboard's EasyWP cache control. [Namecheap documents the manual dashboard cache control](https://www.namecheap.com/support/knowledgebase/article.aspx/10015/2279/easywp-plugins-cache-plugin-seo-plugin-and-blocked-plugins/). Cache purge is a separate action from publishing files. If browser verification fails first, purge and rerun verification; do not treat the failed run as recovery.
5. Invalidate CDN copies of the legacy `https://slayerkey.com/wp-content/plugins/slayerkey-website/assets/js/tracking.js` URL, including query variants and any rewritten ShortPixel URL seen in old HTML. Invalidate `/` and the affected YouTube campaign variants at the HTML cache layers. Inventory variants from the captured HARs and current campaign links. A purge by a single cache-busting query is insufficient. Do not disable ShortPixel image optimization.
6. Verify each layer separately: record ordinary HTML response `Age`, `X-Cache`, `CF-Cache-Status`, `Cache-Control`, and `Vary`; record redirect chains for rewritten assets; compare final response bytes with the manifest. A CDN `HIT` is acceptable only when its bytes match. A current health response proves neither current HTML nor current browser assets.
7. Set `DEPLOY_SHA` to the approved full deployment SHA, then run `npm run test:live`. Use the downloaded release's `DEPLOYED_ASSETS.json` via `MANIFEST_PATH`, or let the runner fetch the commit-specific manifest. Require at least three consecutive successful runs on fresh browser contexts, ordinary `/`, YouTube campaign URL, and warm reloads. Save artifacts with UTC timestamps. Confirm both Whop destinations manually without purchasing and inspect real YouTube playback on a physical phone.
8. Confirm the hourly smoke workflow is enabled and its expected SHA matches the latest deployment run. Recovery requires passing ordinary-URL browser checks after the purge, not a successful upload, health status, or this PR's local results.

The verifier never submits Kit forms or purchases a checkout. Automation tests the existing Kit submission endpoint using an intercepted response in the isolated fixture.

## Rollback preparation

Run `python tools/build_rollback.py` in a fresh checkout. It copies the current plugin's delivery/routing safeguards and restores homepage HTML, CSS, Dojo JS, and tracking from `0ff5f81f6337650e47b3d1a0e18e38117466f2e7`. Two legacy chooser URL initializers are adapted to derive their links from pricing, replacing the removed PHP observer's attribution role. Tracking remains byte-identical to the tested pre-regression hash. The tool then uses the same fingerprinted builder. Output: `build/rollback/plugin/` and `build/rollback/file-hashes.json`; `--output` permits a separate new directory. This is a temporary return to the tested pre-incident behavior, with its historical JS-dependent video/reveals and continuous carousel cost; it is not equivalent to the complete reliability repair.

Never use `601a2c09` or `460e07d` as rollback sources. The rollback tool pins the safe parent and accepts no arbitrary revision.

## Rollback execution after approval

1. Preserve the failed release artifact and diagnostics. Ensure no deployment is running; use the same serialized release window.
2. Validate the prepared rollback's manifest and tracking SHA. Run `python tools/publish_deploy.py --artifact build/rollback/plugin` with the authorized SFTP environment. This uses the same asset-first verification and retains all older hashed files.
3. Clear EasyWP page cache, then invalidate the affected homepage/CDN variants and legacy tracking references as above. Keep the two native Body pricing links unless a specific observed incompatibility requires restoring the saved Body snapshot.
4. Set `DEPLOY_SHA=0ff5f81f6337650e47b3d1a0e18e38117466f2e7`, `MANIFEST_PATH=build/rollback/plugin/DEPLOYED_ASSETS.json`, and `ROLLBACK_RUNTIME=1`; run `npm run test:live` three times. The rollback mode permits only this pinned revision's historical JS-initialized iframe, while retaining hash, playback and interaction checks. Require responsive 35-second sessions, both plan URLs, proof close/focus/scroll, and no mutation storm.
5. A manual rollback changes the expected release outside the main deployment history. Set repository Actions variable `SLAYERKEY_EXPECTED_DEPLOY_SHA` to the approved pinned rollback SHA. The scheduled verifier accepts only this pre-regression override and continues checking it hourly. Clear the variable when returning to a normal release. Purge a stale commit-specific rollback manifest if its bytes predate the fingerprinted packaging. Do not ignore an expected-SHA mismatch or call the site recovered based on a rollback upload alone.

No cache purge or live publisher execution was performed while preparing this PR.
