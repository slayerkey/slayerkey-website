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

        var pageVariantElement = element.closest('[data-page-variant]') || document.querySelector('[data-page-variant]');
        var properties = {
            cta_id: element.getAttribute('data-sk-cta'),
            offer_id: element.getAttribute('data-sk-offer') || null,
            cta_location: element.getAttribute('data-sk-location') || null,
            cta_text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
            page_variant: pageVariantElement ? pageVariantElement.getAttribute('data-page-variant') : null,
            page_path: window.location.pathname
        };

        window.posthog.capture('cta_click', properties);

        if (element.getAttribute('data-sk-checkout') === 'true') {
            window.posthog.capture('begin_checkout', properties);
        }
    });
})();
