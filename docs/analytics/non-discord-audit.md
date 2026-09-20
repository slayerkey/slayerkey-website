# Non Discord analytics audit

## Scope

This audit covers slayerkey.com, website funnel instrumentation, lead capture, checkout tracking, Stripe and Whop purchase webhooks, and analytics handoff.

It intentionally excludes every Discord bot, Dojo activation, training task, win, RR, membership role, and dojo-infrastructure implementation. Those systems are being developed separately and must not be modified from this branch.

## Current production architecture

### Browser analytics

The WordPress plugin loads PostHog sitewide through the managed first party host at edge.slayerkey.com.

The GitHub managed tracking script currently owns intentional PostHog CTA tracking through data-sk-cta attributes.

PostHog SDK defaults also provide the standard browser pageview and autocapture behavior configured by the SDK.

### WordPress WPCode

The files under docs/wordpress/wpcode are reference snapshots of live WordPress WPCode snippets. They are not automatically deployed from GitHub.

The footer snapshot currently contains:

1. GA4 CTA click tracking
2. GA4 begin_checkout tracking
3. The Kit lead magnet form
4. The free plan popup and #free-plan behavior
5. A Whop lead event after successful Kit submission

Kit form ID 9535572 is production sensitive and must remain unchanged unless intentionally migrated.

### Payment confirmation

Stripe checkout.session.completed events are signature verified. Only paid sessions are recorded.

Whop payment.succeeded events are signature verified.

Both providers send the server side PostHog event sale_confirmed.

Duplicate provider events are suppressed with a 30 day transient.

The Improvement System welcome page additionally fires system_purchase_success in the browser. This is a convenience conversion signal, not an authoritative purchase source, because visiting the page is not equivalent to a verified payment.

## Audit findings

### 1. PostHog had CTA clicks but no explicit checkout start event

The website can measure CTA interest but did not have a provider independent PostHog checkout event.

This branch adds checkout_started for direct Whop and Stripe checkout destinations.

Properties:

* provider
* cta_id
* cta_location
* offer
* page_path

The event is deliberately non blocking. Analytics failure cannot interrupt checkout navigation.

### 2. The free routine lead was not recorded in PostHog

The existing lead form records email_signup in GA4 and lead in Whop after the Kit request succeeds.

This branch prepares a matching PostHog event in the WPCode reference snapshot:

lead_submitted

Properties:

* lead_magnet = 30_day_rank_up_routine
* method = popup
* page_path

No email address or form contents are sent to PostHog.

Because the WPCode files are snapshots only, this change is not live until the production WPCode footer is manually compared and updated.

### 3. sale_confirmed is authoritative but not person linked

The current server side purchase helper intentionally sets process_person_profile to false and uses a distinct ID derived from the provider event ID.

That makes sale_confirmed privacy preserving and reliable for counting verified sales, but it does not create a durable customer identity and cannot currently join a verified purchase back to a specific anonymous website visitor.

Do not change this by guessing a customer identifier.

A later identity project should only proceed after the exact Stripe and Whop customer identifiers and browser to checkout handoff are verified.

### 4. system_purchase_success should remain secondary

The Improvement System welcome page uses localStorage to fire system_purchase_success once per browser.

This is useful for browser funnel diagnostics but must not replace Stripe sale_confirmed for revenue or purchase counts.

### 5. GitHub is not the complete deploy surface yet

The GitHub managed plugin can be tested and deployed automatically.

The production WPCode footer is still a manual WordPress surface. Its repo file is a reference snapshot only.

Long term, migrating the live WPCode behavior into the tested GitHub managed plugin would reduce drift and make the whole website runtime reviewable before deployment.

## Canonical website funnel

Use these events for the non Discord website funnel:

1. $pageview
2. cta_click
3. lead_submitted when the visitor submits the free 30 day routine form
4. checkout_started when the visitor leaves for a supported Stripe or Whop checkout
5. sale_confirmed from a verified provider webhook

Use system_purchase_success only as a secondary Improvement System browser diagnostic.

## Offer property values

Current intentional offer values include:

* dojo
* improvement_system
* coaching_mentorship

Keep these stable across CTA and checkout events.

## Changes prepared on this branch

### Plugin code

wordpress/slayerkey-website/assets/js/tracking.js

Adds checkout_started for direct Whop and Stripe destinations.

### WPCode reference snapshot

docs/wordpress/wpcode/footer.html

Adds lead_submitted after the existing Kit request succeeds.

This file is not automatically deployed.

### Browser tests

tests/browser/homepage.spec.mjs

Adds regression coverage that:

1. checkout_started fires for a direct Whop checkout
2. checkout_started identifies the provider and offer
3. lead_submitted fires after the mocked Kit submission succeeds
4. no email value is required by analytics assertions

## Deliberately not implemented

1. No Discord or dojo-infrastructure changes
2. No production deployment
3. No merge to main
4. No customer identity rewrite
5. No PostHog dashboard creation because the available PostHog connector in this environment is attached to an unrelated project
6. No automatic WPCode deployment
7. No revenue values inferred from stale WPCode checkout tables

## Manual production checklist

Before merging or applying anything:

1. Review the branch diff.
2. Run CI and browser tests.
3. Verify the connected PostHog project is the actual Slayerkey project.
4. Compare the current live WPCode footer with docs/wordpress/wpcode/footer.html.
5. If they still match around the Kit success handler, manually add the lead_submitted block to live WPCode.
6. Verify checkout_started in PostHog using a test checkout click.
7. Verify lead_submitted with a non customer test address only if a safe test flow is available.
8. Verify sale_confirmed continues to arrive from Stripe and Whop.
9. Only then merge the website branch.
10. Do not coordinate or merge any Discord bot work through this branch.

## Implementation readiness

Website code and tests: READY FOR REVIEW

WPCode production application: MANUAL INPUT REQUIRED

PostHog live project validation: MANUAL INPUT REQUIRED

Persistent purchase identity: DEFERRED UNTIL PROVIDER IDENTITY HANDOFF IS VERIFIED
