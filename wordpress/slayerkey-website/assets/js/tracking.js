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

    function setText(root, selector, text) {
        var element = root.querySelector(selector);

        if (element && element.textContent !== text) {
            element.textContent = text;
        }
    }

    function updateLeadMagnetCopy() {
        var popup = document.getElementById('sk-ep');

        if (popup) {
            setText(popup, '.sk-ep-title', 'Get Your Free 30-Day Valorant Rank-Up Routine.');
            setText(popup, '.sk-ep-desc', 'Know what to practice, what to focus on, and what to review for the next 30 days.');
            setText(popup, '.sk-ep-fine', "You'll also get my weekly Valorant improvement emails. Unsubscribe anytime.");
            setText(popup, '.sk-ep-ok-msg', "Check your inbox and click confirm to get the routine. Check spam if you don't see it.");

            var submit = popup.querySelector('.sk-ep-btn');
            if (submit && !submit.disabled && submit.textContent !== 'Send Me the Routine') {
                submit.textContent = 'Send Me the Routine';
            }
        }

        document.querySelectorAll('.sk-fp-float[data-ep-open]').forEach(function (link) {
            link.textContent = '🎯 Free 30-Day Rank-Up Routine';
            link.setAttribute('data-sk-cta', 'lead-magnet-open');
            link.setAttribute('data-sk-location', 'floating');
            link.setAttribute('data-sk-offer', '30-day-rank-up-routine');
        });

        document.querySelectorAll('a').forEach(function (link) {
            var label = (link.textContent || '').replace(/\s+/g, ' ').trim();
            var href = link.getAttribute('href') || '';

            if (label === 'Free Improvement Plan' || label === '(FREE) Starter Pack' || href.indexOf('ko-fi.com/s/05c066f8a7') !== -1) {
                link.textContent = 'Free 30-Day Rank-Up Routine';
                link.setAttribute('href', '#free-plan');
                link.setAttribute('data-ep-open', '');
                link.setAttribute('data-sk-cta', 'lead-magnet-open');
                link.setAttribute('data-sk-location', 'footer');
                link.setAttribute('data-sk-offer', '30-day-rank-up-routine');
                link.removeAttribute('target');
            }
        });
    }

    function openLeadMagnetFromHash() {
        if (window.location.hash !== '#free-plan') {
            return;
        }

        updateLeadMagnetCopy();

        if (typeof window.SK_openFreePlan === 'function') {
            window.SK_openFreePlan();
            return;
        }

        var popup = document.getElementById('sk-ep');
        if (!popup) {
            return;
        }

        popup.hidden = false;
        document.documentElement.style.overflow = 'hidden';
    }

    function syncLeadMagnet() {
        updateLeadMagnetCopy();
        openLeadMagnetFromHash();
    }

    function initialize() {
        updateLegacyDojoPrice();
        alignDojoPricingCards();
        updateWelcomeDiscordLink();
        syncLeadMagnet();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', syncLeadMagnet);
    window.addEventListener('hashchange', syncLeadMagnet);

    window.setTimeout(updateLegacyDojoPrice, 750);
    window.setTimeout(alignDojoPricingCards, 750);
    window.setTimeout(updateWelcomeDiscordLink, 750);
    window.setTimeout(syncLeadMagnet, 50);
    window.setTimeout(syncLeadMagnet, 250);
    window.setTimeout(syncLeadMagnet, 1000);
    window.setTimeout(syncLeadMagnet, 2500);

    if ('MutationObserver' in window) {
        var leadMagnetObserver = new MutationObserver(function () {
            syncLeadMagnet();
        });

        if (document.documentElement) {
            leadMagnetObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
            window.setTimeout(function () {
                leadMagnetObserver.disconnect();
            }, 10000);
        }
    }

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