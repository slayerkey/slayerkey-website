(function () {
    'use strict';

    function updateLegacyDojoPrice() {
        var path = window.location.pathname.replace(/\/+$/, '') || '/';

        if (path !== '/' && path !== '/std') {
            return;
        }

        var root = document.querySelector('main') || document.body;

        if (!root) {
            return;
        }

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var node;

        while ((node = walker.nextNode())) {
            var parent = node.parentElement;

            if (parent && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(parent.tagName)) {
                continue;
            }

            if (!node.nodeValue) {
                continue;
            }

            node.nodeValue = node.nodeValue
                .replace(/\$15/g, '$20')
                .replace(/Fifteen dollars/g, 'Twenty dollars')
                .replace(/fifteen dollars/g, 'twenty dollars');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateLegacyDojoPrice);
    } else {
        updateLegacyDojoPrice();
    }

    window.setTimeout(updateLegacyDojoPrice, 750);

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
            cta_location: element.getAttribute('data-sk-location') || null,
            offer: element.getAttribute('data-sk-offer') || null,
            plan_direct: element.getAttribute('data-sk-plan-direct') === 'true',
            page_path: window.location.pathname
        });
    }, true);
})();
