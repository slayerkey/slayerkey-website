# Slayerkey Website

**GitHub is the source of truth** for the custom WordPress website code used on slayerkey.com.

The normal production path is fully cloud based:

`local working copy (optional) -> GitHub main -> GitHub Actions -> EasyWP -> Cloudflare -> slayerkey.com`

Your computer does **not** need to be online for GitHub to test or deploy the website.

## Recommended Windows / D: drive workflow

The recommended local working copy is:

`D:\Slayerkey-Website`

The local folder is only a convenient place to edit the site with Codex, VS Code, Stream Deck shortcuts, or normal file tools. GitHub `main` remains canonical.

### First-time setup

From PowerShell, this can create/update the D: drive working copy:

```powershell
irm https://raw.githubusercontent.com/slayerkey/slayerkey-website/main/tools/windows/setup-local.ps1 | iex
```

The setup defaults to `D:\Slayerkey-Website`. A different location can be supplied when running the script from a local copy with `-Path`.

### Everyday use

Inside `D:\Slayerkey-Website`:

1. Before editing, run **`PULL FROM GITHUB.cmd`**.
2. Make the website changes locally.
3. When finished, run **`PUSH TO GITHUB.cmd`**.
4. Enter a short commit message, or press Enter for an automatic timestamped message.
5. The script rebases onto the latest GitHub `main`, commits the local edits, pushes them, and GitHub Actions handles deployment.

If a pull would overwrite local edits, the pull helper stops instead of modifying them. If Git authentication is not already configured on Windows, the first push may ask you to sign in through Git Credential Manager.

These two `.cmd` files are also stable targets for Stream Deck buttons.

## WordPress plugin

The deployable plugin lives at:

`wordpress/slayerkey-website/`

The production foundation provides:

1. Sitewide PostHog loading through the managed first party proxy at `edge.slayerkey.com`.
2. A lightweight CTA event convention using `data-sk-cta`.
3. A page loader shortcode for GitHub managed HTML pages.
4. A lightweight public health endpoint for deployment diagnostics.

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

It returns the active plugin version, the exact deployed Git commit, hashes for critical assets, PostHog configuration, and whether the production hooks are registered. It does not expose the PostHog project token.

## Versions and experiments

Use Git history for normal revisions and tags for important production milestones or redesign launches.

For A/B tests, keep control and variants beside the relevant page under an `experiments` directory and include a short README describing the hypothesis, primary metric, traffic allocation, dates, and result. PostHog feature flags and experiments can be connected when the test is ready to launch.

Legacy redesigns that currently live outside Git should be imported once into a clearly named archive rather than mixed into live production files.

## EasyWP deployment

Deployment uses **GitHub-hosted Actions over SFTP**. No self-hosted runner or always-on local computer is required.

Required repository secrets:

* `EASYWP_HOST`
* `EASYWP_USER`
* `EASYWP_PASSWORD`
* `EASYWP_PORT`

Use port `22` for `EASYWP_PORT`.

Relevant pushes to `main` run the EasyWP deployment workflow. The workflow builds the immutable plugin release, uploads `wordpress/slayerkey-website` into EasyWP's WordPress plugin directory, then downloads and byte-compares the critical deployed files before marking the deployment successful.

The **Slayerkey Website** plugin only needs to be activated once in WordPress Admin. Future plugin and page updates deploy from GitHub without another activation step.

### Deployment contract

A commit being present on `main` does **not** by itself mean it reached EasyWP.

Each deployment commit gets a status named:

`easywp/deploy`

Interpret it as:

* missing status = no production deployment was triggered for that commit
* pending = GitHub is testing/publishing
* failure = the reliability gate, SFTP publication, or EasyWP remote-byte verification failed
* success = the exact release was published to EasyWP and the remote files match the release GitHub built

The production gate intentionally does **not** require a self-hosted browser on your PC. Cloudflare can return 403 to GitHub datacenter browser traffic, so that signal is kept separate from the authoritative publish/byte-verification path.

A manual public-browser diagnostic remains available as the **Manual Live Dojo Smoke** workflow. It is not scheduled and it does not control `easywp/deploy`.

The deployment workflow uses one production concurrency group with `cancel-in-progress: false`, so deployments serialize instead of relying on a local machine.

For a private Dojo preview, use the exact verified deployment SHA as the cache buster:

`https://slayerkey.com/preview/dojo-v3/?cb=<verified-commit-sha>`

## Safety

Private analytics exports, service account credential files, local browser installs, and local agent settings are excluded by `.gitignore` and should never be committed.
