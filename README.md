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

It returns the active plugin version, the exact deployed Git commit, hashes for the critical Dojo HTML/JS/CSS files, PostHog configuration, and whether the production hooks are registered. It does not expose the PostHog project token.

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

Every push to `main` runs the EasyWP deployment workflow. The workflow uploads only the `wordpress/slayerkey-website` folder into EasyWP's WordPress plugin directory.

The **Slayerkey Website** plugin only needs to be activated once in WordPress Admin. Future plugin and page updates deploy from GitHub without another activation step.

### Deployment contract

A commit being present on `main` does **not** mean it is live on EasyWP.

Each `main` commit gets a commit status named:

`easywp/deploy`

Interpret it strictly:

* missing status = the deploy workflow has not started, so the commit is **not verified live**
* pending = deployment or verification is still running
* failure = SFTP deployment, remote byte verification, or public HTTP verification failed
* success = EasyWP contains the exact commit and the public site serves the exact Dojo assets for that commit

Do not hand off a preview URL, call a change deployed, or promote a preview to live until `easywp/deploy` is `success` for the exact commit being discussed.

The workflow verifies deployment in three layers:

1. It builds content addressed Dojo JS/CSS filenames from SHA256 hashes and rewrites the deployed PHP preview map to use those unique physical asset paths. This avoids relying on query string cache busting for EasyWP/CDN static assets.
2. It uploads the plugin and critical Dojo files over SFTP, then downloads them back and byte compares them with the workflow workspace.
3. It requests the public `DEPLOYED_COMMIT.txt`, `DEPLOYED_ASSETS.json`, content addressed JS/CSS files, and `/wp-json/slayerkey/v1/health` endpoint. It verifies the exact commit, plugin version, and SHA256 hashes seen through HTTP before marking the commit successful.

The workflow also uses a single concurrency group with `cancel-in-progress: true`, so an older deployment cannot finish after a newer deployment and overwrite the server with stale files.

For a private Dojo preview, use the exact verified deployment SHA as the cache buster:

`https://slayerkey.com/preview/dojo-v3/?cb=<verified-commit-sha>`

## Safety

Private analytics exports, service account credential files, local browser installs, and local agent settings are excluded by `.gitignore` and should never be committed.
