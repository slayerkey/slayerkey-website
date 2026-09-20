# Non Discord website analytics audit

## Scope

This audit covers only slayerkey.com and the repository slayerkey/slayerkey-website.

It intentionally excludes every Discord bot, Discord tracking system, RR tracker, membership role system, Dojo activation implementation, and any repository other than slayerkey/slayerkey-website.

Review branch:

audit/non-discord-analytics-prep

Draft pull request:

#53

Nothing on this branch has been merged to main or deployed to EasyWP.

## Verified architecture

### PostHog browser analytics

The WordPress plugin loads PostHog from the first party analytics host:

edge.slayerkey.com

The PostHog project token is embedded client side as expected for a browser project token.

The custom browser tracking script is:

wordpress/slayerkey-website/assets/js/tracking.js

It is enqueued sitewide outside admin, private preview, and public work requests.

The custom script currently records intentional CTA interactions through data-sk-cta attributes.

The browser SDK itself owns normal PostHog browser behavior such as pageview collection. The custom script does not manually duplicate pageview capture.

### GA4 and Whop browser analytics

The current production WPCode header snapshot is:

docs/wordpress/wpcode/header.html

It contains:

1. The Whop pixel and whop.track("page")
2. GA4 initialization for property G-0SZBZW0HP6
3. Microsoft Clarity initialization

The production WPCode footer snapshot is:

docs/wordpress/wpcode/footer.html

It contains:

1. GA4 CTA click tracking
2. GA4 begin_checkout tracking
3. The Free 30 Day Rank Up Routine popup
4. The Kit form submission
5. Whop lead tracking after the Kit submission path
6. The floating #free-plan CTA and popup behavior

These WPCode files are reference snapshots only. GitHub does not automatically publish them to WordPress.

### Kit lead flow

The Free 30 Day Rank Up Routine submits to Kit form:

9535572

The form uses a no CORS fetch to the existing Kit endpoint.

The current success UI runs after the fetch promise resolves. Because the request is no CORS, this means lead_submitted should be interpreted as a submission event, not proof that Kit created a subscriber.

No email address, name, or form body is sent to PostHog by the prepared analytics change.

### Stripe purchase confirmation

The Stripe endpoint remains:

/wp-content/plugins/slayerkey-website/stripe-webhook.php

The endpoint only accepts POST.

Signature verification checks:

1. The Stripe signature timestamp
2. One or more v1 signatures
3. The exact raw request body
4. A five minute timestamp tolerance
5. Constant time comparison through hash_equals

Only checkout.session.completed is processed.

A completed session is counted only when payment_status is paid.

The verified sale is sent to PostHog as:

sale_confirmed

If the Checkout Session contains a Stripe Customer ID, the raw Customer ID is never sent to PostHog. It is SHA 256 hashed into a pseudonymous stripe_customer_ identity so repeat purchases from the same Stripe Customer can group together.

If no Stripe Customer exists, the event falls back to the existing event based sale identity.

The standalone Stripe endpoint now delegates to the shared testable handler in sales-webhook-common.php.

### Whop purchase confirmation

The primary Whop endpoint remains:

/wp-json/slayerkey/v1/whop-webhook

The compatibility endpoint remains:

/wp-content/plugins/slayerkey-website/whop-webhook.php

Only payment.succeeded is processed.

The Whop verifier checks:

1. webhook-id
2. webhook-timestamp
3. webhook-signature
4. The exact raw body
5. A five minute timestamp tolerance
6. Constant time signature comparison

Current Whop ws_ secrets use the literal secret bytes as the HMAC key.

Legacy Standard Webhooks whsec_ secrets are decoded from the base64 material after the prefix before HMAC verification.

The handler tolerates the current and historical user identity shapes that may appear on the payment payload:

1. user_id
2. user as a string
3. user.id when expanded

When a Whop user ID is available, the raw ID is never sent to PostHog. It is SHA 256 hashed into a pseudonymous whop_user_ identity so repeat Whop payments from the same buyer can group together.

When no usable user identity exists, sale_confirmed falls back to the existing event based sale identity.

### Duplicate purchase handling

Both providers use the existing processed event mechanism in sales-webhook-common.php.

A successful provider event is marked processed only after PostHog accepts the sale event.

Repeated provider delivery within the existing 30 day dedupe window returns a duplicate success response and does not recapture PostHog.

If PostHog delivery fails, the provider receives a non 2xx response so it can retry.

The branch does not weaken this behavior.

### Improvement System browser success signal

/system/welcome loads:

previews/system-welcome/assets/welcome.js

It emits:

system_purchase_success

The event is guarded once per browser through localStorage.

This event is useful as a browser diagnostic only.

It is not an authoritative purchase signal because reaching a browser page is not equivalent to a verified provider payment.

For revenue and purchase counts, sale_confirmed remains authoritative.

## Final event taxonomy

### $pageview

Source:

PostHog browser SDK

Purpose:

Top of funnel traffic and path analysis.

### cta_click

Source:

GitHub managed tracking.js

Properties:

cta_id
cta_location
offer
plan_direct
page_path

Purpose:

Measure intentional CTA interaction.

### lead_submitted

Source:

WPCode footer snapshot

Trigger:

The existing Kit request reaches its current success path.

Properties:

lead_magnet = 30_day_rank_up_routine
method = popup
page_path

No PII is included.

Purpose:

Measure free routine submissions.

This is a submission event, not a guaranteed subscriber confirmation event.

### checkout_started

Source:

GitHub managed tracking.js

Trigger:

A data-sk-cta anchor points directly to a supported checkout destination.

Supported providers:

Whop
Stripe

Properties:

provider
cta_id
cta_location
offer
page_path

Purpose:

Provide one provider independent checkout intent event in PostHog.

Analytics failure is fail open and cannot block navigation.

### sale_confirmed

Source:

Verified Stripe or Whop server webhook

Properties include only provider and useful non sensitive classification data.

Purpose:

Authoritative verified purchase metric.

### system_purchase_success

Source:

Improvement System welcome browser script

Purpose:

Secondary browser diagnostic only.

Do not use it as the canonical purchase count.

## Final non Discord funnel

Primary commerce path:

$pageview
→ cta_click
→ checkout_started
→ sale_confirmed

Lead path:

$pageview
→ cta_click or free plan interaction
→ lead_submitted

Improvement System post purchase diagnostic:

sale_confirmed
plus optional system_purchase_success browser observation

## Offer taxonomy

Keep these existing offer values stable:

dojo
improvement_system
coaching_mentorship

## GA4 checkout mapping audit

The production WPCode reference snapshot was stale before this audit.

It still referenced:

1. The old $15 Dojo plan
2. Old Ko fi Improvement System checkout
3. Old Ko fi Mentorship checkout

The branch updates the WPCode reference snapshot to the current authored paid offers:

Training Dojo Monthly
$19.99
Whop plan_eVop6pXsIhHlf

Training Dojo Annual
$199.99
Whop plan_kaaoYadRlBi4n

Improvement System
$249
Current Stripe Payment Link

Private Mentorship paid in full
$1,200
Current Stripe Payment Link

Private Mentorship payment plan
$1,300 total
Current Stripe Payment Link

This update is not live until the production WPCode footer is manually compared and updated.

## Purchase identity status

### Provider repeat buyer grouping

Prepared on this branch.

Whop:

Uses a one way hash of the Whop user ID when available.

Stripe:

Uses a one way hash of the Stripe Customer ID when available.

Neither provider raw customer identifier is sent to PostHog.

### Anonymous browser to verified purchase stitching

Deferred.

The current website uses static Whop plan checkout links and static Stripe Payment Links.

The audit did not find a proven, currently supported browser reference handoff in the existing static URL architecture that can be added without changing how checkout is created.

Stripe supports client_reference_id when a Checkout Session is created explicitly, and Stripe pricing tables support a client reference property, but this branch does not create Checkout Sessions or use a pricing table.

Whop Checkout Configuration metadata can carry application metadata when checkout is created through the API, but the current Dojo links are static plan links.

Therefore this branch does not invent browser to purchase stitching.

The provider level repeat buyer identities above are the safe implementation for now.

## Tests

The branch adds browser coverage for:

1. checkout_started on Whop
2. checkout_started on Stripe
3. Provider and offer properties
4. Current GA4 begin_checkout mapping for all five paid offers
5. lead_submitted after the mocked Kit request success path
6. No lead email in PostHog event properties

The branch adds PHP coverage for:

1. Valid Whop payment signature
2. Invalid Whop signature
3. Duplicate Whop delivery
4. Current ws_ Whop signing secret behavior
5. Legacy whsec_ Standard Webhooks signing secret behavior
6. Whop user_id payload identity
7. Whop string user identity
8. Whop expanded user identity
9. No raw Whop user ID in PostHog
10. Valid Stripe checkout.session.completed signature
11. Invalid Stripe signature
12. Duplicate Stripe delivery
13. Unpaid Stripe session rejection
14. Stripe pseudonymous Customer identity
15. No raw Stripe Customer ID in PostHog
16. Stripe event identity fallback when no Customer exists

The existing reliability suite also includes build, publication, browser matrix, soak, and live verification coverage.

## CI status

Draft PR #53 repeatedly creates the Homepage Reliability Checks workflow, but the GitHub hosted reliability job fails before any workflow step starts.

Latest observed run:

35507521588

Branch head at that run:

56d27aca4620c561968dffa31f65ed0f3abae4cc

Observed behavior:

1. The run starts and fails in approximately three seconds.
2. A reliability job object exists.
3. The job contains zero recorded steps.
4. Checkout, npm, PHP, Playwright, and repository test commands never start.
5. GitHub provides no downloadable job log for the failed job through the available connection.

This is a pre runner GitHub Actions startup failure, not a repository test assertion.

The repository alone cannot identify whether the account level subtype is billing, Actions budget, policy, entitlement, or hosted runner provisioning.

GitHub Actions must successfully start a runner before this PR can be called CI green.

## Deployment architecture

### Pull requests

PRs targeting main run:

.github/workflows/checks.yml

The reliability job performs:

1. npm ci
2. Chromium and WebKit installation
3. Unit build tests
4. Publisher tests
5. PHP tests
6. Fingerprinted build PHP tests
7. Full Playwright browser suite
8. Soak test

### Main branch deployment

.github/workflows/deploy.yml triggers on main when relevant WordPress or deployment files change.

It classifies changes into:

full reliability gate
or
copy only fast gate

Deployment occurs only when the applicable gate succeeds.

The deploy job:

1. Builds immutable fingerprinted assets
2. Publishes over SFTP to EasyWP
3. Verifies staged hashes
4. Verifies public immutable asset bytes before publishing PHP references
5. Publishes HTML and PHP references
6. Runs ordinary URL browser verification
7. Records easywp/deploy commit status

### Scheduled live verification

.github/workflows/verify-live-dojo.yml runs the production browser verifier on a schedule and by manual dispatch.

### WPCode boundary

docs/wordpress/wpcode/header.html
docs/wordpress/wpcode/body.html
docs/wordpress/wpcode/footer.html

are documentation snapshots only.

They are not part of the EasyWP automated publication path.

## Files changed on this branch

docs/analytics/non-discord-audit.md

docs/wordpress/wpcode/footer.html

tests/browser/homepage.spec.mjs

tests/wordpress.php

wordpress/slayerkey-website/assets/js/tracking.js

wordpress/slayerkey-website/sales-webhook-common.php

wordpress/slayerkey-website/stripe-webhook.php

No Discord repository or Discord implementation is touched.

## Manual production steps after CI is unblocked

1. Resolve the GitHub Actions pre runner startup failure so the reliability workflow can actually execute.
2. Require the complete PR #53 reliability suite to pass.
3. Review the final PR diff.
4. Verify the PostHog project receiving edge.slayerkey.com traffic is the intended Slayerkey project.
5. Compare the live WordPress WPCode footer with docs/wordpress/wpcode/footer.html.
6. Manually apply only the reviewed WPCode changes for lead_submitted and the current GA4 checkout map.
7. Test a safe free routine submission and verify lead_submitted without PII.
8. Click a safe Whop checkout link and Stripe checkout link and verify checkout_started.
9. Verify a real or provider safe test payment produces one sale_confirmed event from each configured provider.
10. Confirm repeated webhook delivery does not create a second sale_confirmed event.
11. Only after those checks, merge PR #53 and allow the normal main branch deployment workflow to publish the GitHub managed plugin changes.

## Deliberately deferred

Anonymous browser to purchase identity stitching.

Migration of WPCode into the GitHub managed plugin.

Any PostHog dashboard or insight creation until the connected PostHog project is verified as the Slayerkey project.

Any change to provider dashboard webhook configuration.

Any change outside slayerkey/slayerkey-website.

## Implementation readiness

Repository implementation:

Prepared.

Production:

Not changed.

CI:

Blocked before runner startup.

The next required action is outside repository code: restore GitHub Actions runner execution, then allow the complete reliability suite to run before any production step.
