# Slayerkey Website

GitHub is the source of truth for the custom WordPress website code used on slayerkey.com.

## WordPress plugin

The deployable plugin lives at:

`wordpress/slayerkey-website/`

The first version provides:

1. Sitewide PostHog loading using the current US Cloud browser snippet.
2. A lightweight CTA event convention using `data-sk-cta`.
3. A page loader shortcode for GitHub managed HTML pages.

Example shortcode:

`[slayerkey_page page="test"]`

That shortcode renders:

`wordpress/slayerkey-website/pages/test/live/index.html`

## Tracking convention

Important CTA elements can be labeled like this:

`data-sk-cta="home-hero-primary"`

Clicks on labeled elements are captured as the `cta_click` event with the CTA ID and current page path.

PostHog autocapture and pageviews are also enabled by the standard browser SDK defaults.

## EasyWP deployment

Deployment uses GitHub Actions over SFTP.

Required repository secrets:

* `EASYWP_HOST`
* `EASYWP_USER`
* `EASYWP_PASSWORD`
* `EASYWP_PORT`

Use port `22` for `EASYWP_PORT`.

The workflow uploads only the `wordpress/slayerkey-website` folder into EasyWP's WordPress plugin directory.

After the first successful deployment, activate **Slayerkey Website** once in WordPress Admin under Plugins. Future plugin code updates can then deploy from GitHub.

## Safety

Private analytics exports, service account credential files, local browser installs, and local agent settings are excluded by `.gitignore` and should never be committed.
