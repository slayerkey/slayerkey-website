# PostHog diagnostics 0.1.3

Temporary diagnostics to isolate PostHog ingestion and browser loading.

This version sends one server smoke event to each PostHog Cloud region, records browser snippet and SDK load state through a same origin REST callback, and removes the homepage self fetch probe that was being rate limited by EasyWP.

Remove these diagnostics after the PostHog host is confirmed and browser tracking is verified.
