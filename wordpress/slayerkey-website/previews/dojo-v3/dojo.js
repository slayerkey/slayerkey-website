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
        var root = document.getElementById('sk-std');
        if (!root) return;

        /*
         * Fail-safe presentation.
         * The page must remain readable and usable even if an animation, embed,
         * analytics script, or third-party lazy loader fails later.
         */
        var failSafeStyle = document.getElementById('dojoRuntimeFailSafeStyles');
        if (!failSafeStyle) {
            failSafeStyle = document.createElement('style');
            failSafeStyle.id = 'dojoRuntimeFailSafeStyles';
            failSafeStyle.textContent = '' +
                '#sk-std .reveal{opacity:1!important;transform:none!important;filter:none!important}' +
                '#sk-std .reveal.show,#sk-std .reveal.is-visible{opacity:1!important;transform:none!important;filter:none!important}';
            document.head.appendChild(failSafeStyle);
        }

        Array.prototype.forEach.call(root.querySelectorAll('.reveal'), function (el) {
            el.classList.add('show');
        });

        /*
         * VSL should never depend on a long runtime chain before it receives a URL.
         * Load it directly and keep sound opt-in.
         */
        var iframe = document.getElementById('dojoVideo');
        var unmuteButton = document.getElementById('unmuteBtn');
        var videoSrc = 'https://www.youtube.com/embed/H7hYaHnT6ko?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1';

        if (iframe) {
            if (!iframe.getAttribute('src')) iframe.setAttribute('src', videoSrc);

            function postVideoCommand(command) {
                try {
                    iframe.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: command,
                        args: []
                    }), '*');
                } catch (e) {}
            }

            if (unmuteButton) {
                unmuteButton.hidden = false;
                unmuteButton.addEventListener('click', function () {
                    postVideoCommand('unMute');
                    postVideoCommand('playVideo');
                    unmuteButton.hidden = true;

                    window.setTimeout(function () {
                        var src = iframe.getAttribute('src') || '';
                        if (src.indexOf('mute=1') !== -1) {
                            iframe.setAttribute('src', src.replace('mute=1', 'mute=0'));
                        }
                    }, 300);
                });
            }
        }

        /*
         * Keep generic Dojo CTAs simple and fail-safe.
         * No capture-phase interception and no dynamically maintained modal.
         * If JavaScript stops later, these links still point at #pricing.
         */
        var pricing = document.getElementById('pricing');

        Array.prototype.forEach.call(document.querySelectorAll('.sk-cta-btn,.sk-mobile-cta'), function (link) {
            link.setAttribute('href', '#pricing');
            link.removeAttribute('target');
            link.removeAttribute('rel');
        });

        Array.prototype.forEach.call(root.querySelectorAll('[data-sk-checkout="true"]'), function (link) {
            var location = link.getAttribute('data-sk-location') || '';
            var direct = link.getAttribute('data-sk-plan-direct') === 'true' ||
                location === 'pricing_monthly' ||
                location === 'pricing_annual';

            if (!direct) {
                link.setAttribute('href', '#pricing');
                link.removeAttribute('target');
                link.removeAttribute('rel');
            }
        });

        document.addEventListener('click', function (event) {
            if (!pricing || !event.target || !event.target.closest) return;

            var link = event.target.closest('a[href="#pricing"]');
            if (!link) return;

            event.preventDefault();
            pricing.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        /*
         * Preserve the proof lightbox without any global observers.
         */
        var lightbox = document.getElementById('djLightbox');
        if (lightbox) {
            var lightboxImage = lightbox.querySelector('img');
            var lightboxClose = lightbox.querySelector('.dj-lightbox-close');
            var lightboxTrigger = null;

            function closeLightbox() {
                lightbox.classList.remove('open');
                lightbox.setAttribute('aria-hidden', 'true');
                if (lightboxImage) lightboxImage.removeAttribute('src');
                document.body.style.overflow = '';
                if (lightboxTrigger && typeof lightboxTrigger.focus === 'function') {
                    lightboxTrigger.focus();
                }
            }

            Array.prototype.forEach.call(root.querySelectorAll('[data-proof-src]'), function (trigger) {
                trigger.addEventListener('click', function () {
                    if (!lightboxImage) return;

                    lightboxTrigger = trigger;
                    lightboxImage.src = trigger.getAttribute('data-proof-src');

                    var childImage = trigger.querySelector('img');
                    lightboxImage.alt = childImage && childImage.alt ? childImage.alt : 'Expanded proof';

                    lightbox.classList.add('open');
                    lightbox.setAttribute('aria-hidden', 'false');
                    document.body.style.overflow = 'hidden';
                });
            });

            if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', function (event) {
                if (event.target === lightbox) closeLightbox();
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
            });
        }

        /*
         * Best-effort image fallback for lazy-load rewrites. This does not watch the
         * DOM or repeatedly mutate it. It only repairs images that already exist.
         */
        Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
            if (!img.getAttribute('src')) {
                var fallback = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                if (fallback) img.setAttribute('src', fallback);
            }
        });
    });
})();
