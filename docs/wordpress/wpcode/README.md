# WordPress WPCode production snapshots

These files are snapshots of the live WPCode snippets used on slayerkey.com. They exist so Codex and other repo-based tooling can inspect the full production runtime, including code that currently lives outside the GitHub-managed WordPress plugin.

## Files

- `header.html` - live Header WPCode snippet / global design system and analytics bootstrap.
- `body.html` - live Body WPCode snippet / global header navigation and mobile menu markup + behavior.
- `footer.html` - live Footer WPCode snippet / global footer, CTA analytics, Kit lead-magnet popup, `#free-plan` behavior, exit intent, mobile timer, and floating lead-magnet CTA.

## Important

These are **reference snapshots only**. They are not currently deployed automatically from GitHub and should not be treated as an automatic source of truth for writes to WordPress.

Before changing production WPCode:

1. Diagnose the root cause first.
2. Compare the live WPCode snippet against this snapshot.
3. Do not automatically deploy these files to WordPress.
4. Preserve Kit form ID `9535572` unless the form is intentionally migrated.
5. Preserve the current `#free-plan` behavior unless a diagnosed bug requires changing it.
6. Keep analytics non-blocking and fail-open.

The current lead magnet is **Free 30-Day Rank-Up Routine**.

Longer term, after production is stable, consider migrating these snippets into the GitHub-managed plugin so the entire site runtime has one source of truth and can be tested before deployment.
