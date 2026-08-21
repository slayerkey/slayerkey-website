(function () {
    'use strict';

    document.addEventListener('click', function (event) {
        if (!(event.target instanceof Element)) {
            return;
        }

        var element = event.target.closest('[data-sk-cta]');

        if (!element || !window.posthog || typeof window.posthog.capture !== 'function') {
            return;
        }

        window.posthog.capture('cta_click', {
            cta_id: element.getAttribute('data-sk-cta'),
            page_path: window.location.pathname
        });
    });
})();
