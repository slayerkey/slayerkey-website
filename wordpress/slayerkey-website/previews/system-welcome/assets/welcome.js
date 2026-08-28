/* Slayerkey Improvement System post-purchase page (/system/welcome).
   Fires the system_purchase_success conversion event exactly once per
   browser, guarding against refreshes of the confirmation page.
   CTA clicks are handled by the sitewide tracking.js. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    if (!document.getElementById('sk-system-welcome')) return;

    var GUARD_KEY = 'sk_system_purchase_tracked';
    var alreadyTracked = false;

    try {
      alreadyTracked = window.localStorage.getItem(GUARD_KEY) === '1';
    } catch (e) {}

    if (alreadyTracked) return;

    function capture() {
      if (!window.posthog || typeof window.posthog.capture !== 'function') return false;
      window.posthog.capture('system_purchase_success', {
        offer: 'improvement_system',
        page_path: window.location.pathname
      });
      try {
        window.localStorage.setItem(GUARD_KEY, '1');
      } catch (e) {}
      return true;
    }

    /* PostHog loads asynchronously from wp_head; retry briefly if needed. */
    if (!capture()) {
      var attempts = 0;
      var timer = window.setInterval(function () {
        attempts += 1;
        if (capture() || attempts >= 20) {
          window.clearInterval(timer);
        }
      }, 500);
    }
  });
})();
