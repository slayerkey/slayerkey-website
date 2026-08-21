# Slayerkey Website

GitHub is the source of truth for the custom WordPress website code used on slayerkey.com.

## WordPress plugin

The deployable plugin lives at:

`wordpress/slayerkey-website/`

The production foundation provides:

1. Sitewide PostHog loading through the managed first party proxy at `edge.slayerkey.com`.
2. A lightweight CTA event convention using `data-sk-cta`.
3. A page loader shortcode for GitHub managed HTML pages.
4. A lightweight public health endpoint for deployment verification.

PostHog uses US Cloud for the application UI and the managed reverse proxy for SDK assets, feature flags, and event ingestion. Strict script versioning is enabled so dynamically loaded PostHog assets stay on the same SDK version.

## GitHub managed pages

Production page files follow this convention:

`wordpress/slayerkey-website/pages/<page>/live/index.html`

A WordPress or Elementor page can render one with:

`[slayerkey_page page="home"]`

Migrate pages one at a time. Keep the existing WordPress page intact until the GitHub managed version is ready, then replace the page content with the shortcode.

## Tracking convention

Important CTA elements can be labeled like this:

`data-sk-cta="home-hero-primary"`

Clicks on labeled elements are captured as the `cta_click` event with the CTA ID and current page path.

PostHog autocapture and pageviews are enabled by the browser SDK defaults. Add intentional custom events for important funnel actions as those flows are migrated, such as checkout starts, leads, video progress, and purchases.

## Health check

The production plugin exposes:

`https://slayerkey.com/wp-json/slayerkey/v1/health`

It returns the active plugin version, PostHog proxy host, UI host, tracking asset URL, and whether the production hooks are registered. It does not expose the PostHog project token.

## Versions and experiments

Use Git history for normal revisions and tags for important production milestones or redesign launches.

For A/B tests, keep control and variants beside the relevant page under an `experiments` directory and include a short README describing the hypothesis, primary metric, traffic allocation, dates, and result. PostHog feature flags and experiments can be connected when the test is ready to launch.

Legacy redesigns that currently live outside Git should be imported once into a clearly named archive rather than mixed into live production files.

## EasyWP deployment

Deployment uses GitHub Actions over SFTP.

Required repository secrets:

* `EASYWP_HOST`
* `EASYWP_USER`
* `EASYWP_PASSWORD`
* `EASYWP_PORT`

Use port `22` for `EASYWP_PORT`.

The workflow uploads only the `wordpress/slayerkey-website` folder into EasyWP's WordPress plugin directory. Pushes to `main` that change the plugin automatically deploy to EasyWP.

The **Slayerkey Website** plugin only needs to be activated once in WordPress Admin. Future plugin and page updates deploy from GitHub without another activation step.

## Safety

Private analytics exports, service account credential files, local browser installs, and local agent settings are excluded by `.gitignore` and should never be committed.
