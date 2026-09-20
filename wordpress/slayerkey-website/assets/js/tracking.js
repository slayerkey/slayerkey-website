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

    function currentAttribution() {
        var empty = { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null };
        try {
            var q = new URLSearchParams(window.location.search);
            var current = {
                utm_source: q.get('utm_source') || null,
                utm_medium: q.get('utm_medium') || null,
                utm_campaign: q.get('utm_campaign') || null,
                utm_content: q.get('utm_content') || null
            };
            var hasCurrent = current.utm_source || current.utm_medium || current.utm_campaign || current.utm_content;
            if (hasCurrent) {
                try { sessionStorage.setItem('sk_attribution_v1', JSON.stringify(current)); } catch (storageError) {}
                return current;
            }
            try {
                var saved = JSON.parse(sessionStorage.getItem('sk_attribution_v1') || 'null');
                if (saved && typeof saved === 'object') {
                    return {
                        utm_source: saved.utm_source || null,
                        utm_medium: saved.utm_medium || null,
                        utm_campaign: saved.utm_campaign || null,
                        utm_content: saved.utm_content || null
                    };
                }
            } catch (storageError) {}
        } catch (error) {}
        return empty;
    }

    currentAttribution();

    function whopPlanId(href) {
        try {
            var url = new URL(href, window.location.href);
            if (url.hostname !== 'whop.com') return '';
            var match = url.pathname.match(/\/checkout\/(plan_[A-Za-z0-9]+)/);
            return match ? match[1] : '';
        } catch (error) {
            return '';
        }
    }

    function attributedWhopCheckout(element, event) {
        var config = window.SK_TRACKING_CONFIG || {};
        if (!config.whop_attribution_enabled || !config.whop_checkout_endpoint) return false;
        if (element.getAttribute('data-sk-plan-direct') !== 'true') return false;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

        var originalHref = element.href || '';
        var planId = whopPlanId(originalHref);
        if (!planId) return false;

        event.preventDefault();

        var attribution = currentAttribution();
        var metadata = {
            posthog_distinct_id: null,
            posthog_session_id: null,
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_content: attribution.utm_content,
            cta_id: element.getAttribute('data-sk-cta') || null,
            cta_location: element.getAttribute('data-sk-location') || null,
            page_path: window.location.pathname,
            route: 'website'
        };

        if (window.posthog) {
            try {
                if (typeof window.posthog.get_distinct_id === 'function') {
                    metadata.posthog_distinct_id = window.posthog.get_distinct_id();
                }
                if (typeof window.posthog.get_session_id === 'function') {
                    metadata.posthog_session_id = window.posthog.get_session_id();
                }
                if (typeof window.posthog.capture === 'function') {
                    window.posthog.capture('begin_checkout', {
                        plan_id: planId,
                        cta_id: metadata.cta_id,
                        cta_location: metadata.cta_location,
                        page_path: metadata.page_path,
                        route: metadata.route,
                        utm_source: metadata.utm_source,
                        utm_medium: metadata.utm_medium,
                        utm_campaign: metadata.utm_campaign,
                        utm_content: metadata.utm_content
                    });
                }
            } catch (error) { /* Analytics must never interrupt checkout. */ }
        }

        var checkoutWindow = null;
        if (element.target === '_blank') {
            try {
                checkoutWindow = window.open('about:blank', '_blank');
                if (checkoutWindow) checkoutWindow.opener = null;
            } catch (error) {}
        }

        fetch(config.whop_checkout_endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: planId, metadata: metadata })
        })
        .then(function (response) {
            if (!response.ok) throw new Error('Checkout attribution unavailable');
            return response.json();
        })
        .then(function (data) {
            var destination = data && data.purchase_url ? data.purchase_url : originalHref;
            if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.location.href = destination;
            else window.location.href = destination;
        })
        .catch(function () {
            if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.location.href = originalHref;
            else window.location.href = originalHref;
        });

        return true;
    }

    document.addEventListener('click', function (event) {
        if (!(event.target instanceof Element)) {
            return;
        }

        var element = event.target.closest('[data-sk-cta]');

        if (!element) {
            return;
        }

        if (window.posthog && typeof window.posthog.capture === 'function') {
            try { window.posthog.capture('cta_click', {
            cta_id: element.getAttribute('data-sk-cta'),
            cta_location: element.getAttribute('data-sk-location') || null,
            offer: element.getAttribute('data-sk-offer') || null,
            plan_direct: element.getAttribute('data-sk-plan-direct') === 'true',
                page_path: window.location.pathname
            }); } catch (error) { /* Analytics must never interrupt navigation. */ }
        }

        attributedWhopCheckout(element, event);
    }, true);
})();