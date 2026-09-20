(function () {
    'use strict';
    if (window.SK_TRACKING_INITIALIZED) return;
    window.SK_TRACKING_INITIALIZED = true;

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

            var updated = node.nodeValue
                .replace(/\$15/g, '$20')
                .replace(/Fifteen dollars/g, 'Twenty dollars')
                .replace(/fifteen dollars/g, 'twenty dollars');
            if (updated !== node.nodeValue) node.nodeValue = updated;
        }
    }

    function alignDojoPricingCards() {
        if (!document.getElementById('sk-std') || !document.getElementById('pricing')) {
            return;
        }

        var style = document.getElementById('sk-dojo-pricing-alignment');

        if (!style) {
            style = document.createElement('style');
            style.id = 'sk-dojo-pricing-alignment';
            document.head.appendChild(style);
        }

        style.textContent = '' +
            '#sk-std #pricing .dj-plan-options{align-items:stretch!important}' +
            '#sk-std #pricing .dj-price-card,#sk-std #pricing .dj-price-card-premium{transform:none!important}' +
            '#sk-std #pricing .dj-price-card .dj-price,#sk-std #pricing .dj-price-card-premium .dj-price{font-size:3.65rem!important;line-height:1!important}' +
            '#sk-std #pricing .dj-price-card{align-self:stretch!important}';
    }

    function checkoutProviderForElement(element) {
        if (!element || element.tagName !== 'A') {
            return null;
        }

        var href = element.getAttribute('href');
        if (!href) {
            return null;
        }

        try {
            var url = new URL(href, window.location.href);

            if (url.hostname === 'whop.com' && url.pathname.indexOf('/checkout/') === 0) {
                return 'whop';
            }

            if (url.hostname === 'buy.stripe.com') {
                return 'stripe';
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function updateWelcomeDiscordLink() {
        var path = window.location.pathname.replace(/\/+$/, '') || '/';

        if (path !== '/welcome') {
            return;
        }

        var discordUrl = 'https://whop.com/slayerkey/exp_1scafiU5z9mhL2/app/';
        var links = document.querySelectorAll('a');

        links.forEach(function (link) {
            var label = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

            if (label.indexOf('connect your discord') === -1) {
                return;
            }

            link.href = discordUrl;
            link.setAttribute('data-sk-cta', 'welcome-connect-discord');
            link.setAttribute('data-sk-location', 'welcome');
            link.setAttribute('data-sk-offer', 'dojo');
        });
    }

    function initialize() {
        updateLegacyDojoPrice();
        alignDojoPricingCards();
        updateWelcomeDiscordLink();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.setTimeout(updateLegacyDojoPrice, 750);
    window.setTimeout(alignDojoPricingCards, 750);
    window.setTimeout(updateWelcomeDiscordLink, 750);

    document.addEventListener('click', function (event) {
        if (!(event.target instanceof Element)) {
            return;
        }

        var element = event.target.closest('[data-sk-cta]');

        if (!element || !window.posthog || typeof window.posthog.capture !== 'function') {
            return;
        }

        var properties = {
            cta_id: element.getAttribute('data-sk-cta'),
            cta_location: element.getAttribute('data-sk-location') || null,
            offer: element.getAttribute('data-sk-offer') || null,
            plan_direct: element.getAttribute('data-sk-plan-direct') === 'true',
            page_path: window.location.pathname
        };

        try {
            window.posthog.capture('cta_click', properties);

            var checkoutProvider = checkoutProviderForElement(element);
            if (checkoutProvider) {
                window.posthog.capture('checkout_started', {
                    provider: checkoutProvider,
                    cta_id: properties.cta_id,
                    cta_location: properties.cta_location,
                    offer: properties.offer,
                    page_path: properties.page_path
                });
            }
        } catch (error) { /* Analytics must never interrupt navigation. */ }
    }, true);
})();