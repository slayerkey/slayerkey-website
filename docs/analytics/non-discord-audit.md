# Non Discord website analytics reconciliation

## Scope

This audit covers only slayerkey.com and the repository slayerkey/slayerkey-website.

It intentionally excludes Discord bots, RR tracking, membership roles, Dojo product activation tracking, and every repository other than slayerkey/slayerkey-website.

Reconciliation branch:

audit/non-discord-analytics-reconcile

Base commit:

2910bab41898f56459ffad0389b1f1dc683856bd

The branch must not be merged or deployed without explicit Slayerkey approval.

## Why this branch exists

While the earlier analytics audit PR was being validated, a separate analytics implementation was merged directly to main.

That main commit added a stronger Whop attribution architecture:

1. Browser PostHog identity and UTM attribution are collected on direct Dojo checkout clicks.
2. The site can create a Whop Checkout Configuration through a server-side WordPress REST endpoint.
3. Attribution metadata is attached to the Whop checkout configuration.
4. payment.succeeded can return that metadata to the verified webhook.
5. sale_confirmed can therefore reuse the original website PostHog distinct ID and session ID.

This reconciliation branch preserves that newer architecture and layers in the missing audited behavior instead of merging the stale earlier PR.

## Current website funnel

Primary commerce funnel:

$pageview
→ cta_click
→ checkout_started
→ sale_confirmed

Lead funnel:

$pageview
→ free_plan_opened
→ lead_submitted

GA4 continues to use its own begin_checkout event.

PostHog uses checkout_started as the provider-independent checkout event.

## Browser analytics

### cta_click

Source:

wordpress/slayerkey-website/assets/js/tracking.js

Properties:

cta_id
cta_location
offer
plan_direct
page_path

### checkout_started

Source:

wordpress/slayerkey-website/assets/js/tracking.js

Trigger:

A data-sk-cta anchor points directly to a supported Whop or Stripe checkout.

Properties:

provider
cta_id
cta_location
offer
page_path
route
utm_source
utm_medium
utm_campaign
utm_content

Supported providers:

Whop
Stripe

Analytics failure is fail open and cannot block checkout navigation.

### free_plan_opened

Source:

docs/wordpress/wpcode/footer.html

Purpose:

Measure opening the free 30 Day Rank Up Routine form.

The trigger is retained so manual, floating button, hash, mobile timer, and exit intent openings can be differentiated.

### lead_submitted

Source:

docs/wordpress/wpcode/footer.html

Trigger:

The existing Kit form request reaches its current success path.

Properties include:

lead_magnet = 30_day_rank_up_routine
method = popup
trigger
page_path
UTM attribution when available

No submitted email address, name, or form body is included in PostHog.

Because the Kit request uses the existing no CORS flow, lead_submitted means the website submission path completed. It is not independent proof that Kit created a subscriber.

## Whop checkout attribution

The current main architecture is preserved.

Direct Dojo checkout links remain ordinary Whop plan links and continue to work without JavaScript or if the attribution API is unavailable.

When the configured Whop Company API key is available, eligible normal clicks use:

/wp-json/slayerkey/v1/whop-checkout

The server creates a short-lived Whop Checkout Configuration for an allowlisted Dojo plan.

Metadata may include only sanitized attribution fields such as:

posthog_distinct_id
posthog_session_id
UTM parameters
cta_id
cta_location
page_path
route

The API key remains server-side in a non-autoloaded WordPress option.

If Checkout Configuration creation fails, the browser falls back to the original Whop plan URL.

## Verified Whop purchases

Authoritative event:

sale_confirmed

Webhook event:

payment.succeeded

The verifier requires:

webhook-id
webhook-timestamp
webhook-signature
the exact raw request body
a five minute timestamp tolerance
constant time signature comparison

Current ws_ secrets retain literal-key compatibility.

For whsec_ Standard Webhooks-style secrets, the verifier also supports decoded key bytes while preserving the existing raw-secret behavior for historical configurations.

### Whop purchase identity

Preferred identity:

The validated website PostHog distinct ID carried through checkout metadata.

When present:

journey_linked = true
identity_source = website_posthog_distinct_id

The website PostHog session ID is also reused as $session_id when valid.

Fallback identity:

If website metadata is unavailable and the Whop payment contains a user identifier, the identifier is SHA 256 hashed into a pseudonymous whop_user_ identity.

Raw Whop user IDs are not sent to PostHog.

If neither identity is available, the existing event-specific sale identity remains the final fallback.

## Verified Stripe purchases

Public endpoint remains:

/wp-content/plugins/slayerkey-website/stripe-webhook.php

The endpoint delegates to the shared testable handler in:

wordpress/slayerkey-website/sales-webhook-common.php

The verifier requires:

the exact raw request body
Stripe-Signature timestamp
one or more v1 signatures
a five minute timestamp tolerance
constant time HMAC comparison

Only checkout.session.completed is relevant.

Only payment_status = paid is recorded as a verified sale.

### Stripe purchase identity

When Stripe supplies a Customer ID, the raw ID is SHA 256 hashed into a pseudonymous stripe_customer_ identity.

identity_source = stripe_customer_id_hash

Raw Stripe Customer IDs are not sent to PostHog.

If no Customer ID exists, the existing event-specific sale identity remains the fallback.

## Duplicate delivery and retries

Whop and Stripe both use the existing processed-event mechanism.

A provider event is marked processed only after PostHog accepts sale_confirmed.

Repeated delivery inside the existing 30 day dedupe window returns duplicate success without another PostHog capture.

If PostHog delivery fails, the webhook returns non-2xx so the provider can retry.

## Current authored paid offers

Training Dojo Monthly

$19.99
Whop plan_eVop6pXsIhHlf

Training Dojo Annual

$199.99
Whop plan_kaaoYadRlBi4n

Improvement System

$249
Stripe Payment Link 28EbJ04MV4ege3j8VH04804

Private Mentorship paid in full

$1,200
Stripe Payment Link 00w28q3IR4eg8IZ8VH04806

Private Mentorship payment plan

$1,300 total
Stripe Payment Link 4gM00i3IR4eg3oF0pb04805

The WPCode GA4 checkout snapshot on base main still contained stale Ko-fi mappings for the System and Mentorship. This branch replaces those mappings with the authored Stripe destinations above.

## Tests added or strengthened

Browser coverage includes:

1. checkout_started on direct Whop checkout
2. checkout_started on direct Stripe checkout
3. provider, offer, CTA location, and route properties
4. GA4 begin_checkout mapping for all five current paid offers
5. lead_submitted after the existing Kit submission path
6. no lead email in PostHog event properties
7. deterministic chooser destination assertions without opening external Whop popups in the cross-browser edge test
8. separate checkout-click tests that exercise the real browser analytics path

PHP coverage includes:

1. Whop Checkout Configuration creation
2. website PostHog identity forwarded into Whop metadata
3. valid Whop payment signature
4. invalid Whop signature
5. duplicate Whop delivery
6. ws_ raw signing-key behavior
7. compatible whsec_ decoded signing-key behavior
8. website-linked Whop sale identity
9. Whop session and UTM attribution
10. fallback Whop user_id identity
11. fallback Whop string user identity
12. fallback Whop expanded user identity
13. no raw Whop user ID in PostHog
14. valid Stripe checkout.session.completed signature
15. invalid Stripe signature
16. duplicate Stripe delivery
17. unpaid Stripe session rejection
18. pseudonymous Stripe Customer identity
19. no raw Stripe Customer ID in PostHog
20. Stripe event-identity fallback without a Customer

## Reliability gate

The reconciliation branch restores the full browser matrix in the pull-request reliability workflow.

The gate runs:

npm ci
Playwright Chromium and WebKit installation
unit tests
publisher tests
PHP tests
fingerprinted plugin build
built-plugin PHP tests
full Chromium and WebKit browser matrix
five minute browser soak

The earlier WebKit checkout-destination failures were isolated to external popup navigation in the test harness rather than analytics assertions.

The cross-browser edge test now validates both real chooser destinations, UTM attribution, and target behavior without opening an external popup. Separate browser tests exercise the actual checkout click and checkout_started analytics path, so navigation assertions remain covered without depending on unstable WebKit popup behavior.

## Production status discovered during reconciliation

Main commit 2910bab41898f56459ffad0389b1f1dc683856bd passed its full pre-deploy reliability gate.

Its EasyWP deployment subsequently uploaded the release and logged:

Published 2910bab41898f56459ffad0389b1f1dc683856bd

The deployment then failed ordinary live verification with:

Cached HTML release marker mismatch

Therefore the deployment cannot be described as cleanly verified.

The upload occurred before the failure, so production may contain some or all of that main release while Cloudflare or EasyWP continued serving stale cached HTML during verification.

This reconciliation branch has not been deployed.

## WPCode boundary

docs/wordpress/wpcode/header.html
docs/wordpress/wpcode/body.html
docs/wordpress/wpcode/footer.html

remain reference snapshots.

GitHub does not automatically update production WPCode from these files.

The lead_submitted naming change and current GA4 checkout mapping require manual production WPCode comparison/application after review.

## Explicitly not changed

Discord systems

RR tracker

Dojo activation tracking

Provider dashboard webhook configuration

PostHog dashboards or saved insights

Production WPCode

EasyWP production files from this reconciliation branch

## Implementation readiness

Repository reconciliation:

Prepared for CI validation after this audit commit.

Production:

No reconciliation changes deployed.

Required before merge:

1. Open the reconciliation PR against current main.
2. Require the complete reliability suite to pass on the current PR head.
3. Review the final diff.
4. Recheck live release state because the previous main deploy uploaded files but failed cached-HTML verification.
5. Verify the intended PostHog project.
6. Manually compare and apply reviewed WPCode changes.
7. Validate safe lead and checkout events.
8. Validate provider-safe sale_confirmed behavior.
9. Merge only after explicit Slayerkey approval.
