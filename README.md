# Slayerkey Website

GitHub is the source of truth for the custom WordPress website code used on slayerkey.com.

## EasyWP deployment

The repository is prepared to deploy to EasyWP over SFTP with GitHub Actions.

Add these repository secrets in Settings > Secrets and variables > Actions:

- `EASYWP_HOST`
- `EASYWP_USER`
- `EASYWP_PASSWORD`
- `EASYWP_PORT`

Use port `22` for `EASYWP_PORT`.

The first deployment workflow is manual on purpose. After the SFTP connection and destination path are verified, it can be changed to deploy automatically on every push to `main`.
