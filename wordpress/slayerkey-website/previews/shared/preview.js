(function () {
    'use strict';

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(function () {
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        var groups = [
            '.hero-grid > *',
            '.proof-head',
            '.rank-card',
            '.argument > *',
            '.step',
            '.row',
            '.visual',
            '.value > *',
            '.offer',
            '.faq > div',
            '.final .wrap > *'
        ];
        var targets = Array.prototype.slice.call(document.querySelectorAll(groups.join(',')));
        targets.forEach(function (el, index) {
            el.classList.add('sk-reveal');
            el.style.setProperty('--reveal-delay', String((index % 4) * 65) + 'ms');
        });

        if (reduceMotion || !('IntersectionObserver' in window)) {
            targets.forEach(function (el) { el.classList.add('is-visible'); });
        } else {
            var revealObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
            targets.forEach(function (el) { revealObserver.observe(el); });
        }

        var video = document.getElementById('dojoVsl');
        var soundButton = document.getElementById('unmuteBtn');
        if (video && soundButton) {
            video.muted = true;
            var autoplayAttempt = video.play();
            if (autoplayAttempt && typeof autoplayAttempt.catch === 'function') {
                autoplayAttempt.catch(function () {});
            }
            soundButton.addEventListener('click', function () {
                video.muted = false;
                video.volume = 1;
                var playAttempt = video.play();
                if (playAttempt && typeof playAttempt.catch === 'function') {
                    playAttempt.catch(function () {});
                }
                soundButton.hidden = true;
            });
            video.addEventListener('volumechange', function () {
                if (!video.muted && video.volume > 0) soundButton.hidden = true;
            });
        }

        var proofImages = Array.prototype.slice.call(document.querySelectorAll('.visual img, img.zoomable'));
        if (proofImages.length) {
            var lightbox = document.createElement('div');
            lightbox.className = 'sk-lightbox';
            lightbox.setAttribute('aria-hidden', 'true');
            lightbox.innerHTML = '<button class="sk-lightbox-close" type="button" aria-label="Close image">×</button><img alt="Expanded proof">';
            document.body.appendChild(lightbox);
            var big = lightbox.querySelector('img');
            var close = lightbox.querySelector('.sk-lightbox-close');

            function closeLightbox() {
                lightbox.classList.remove('open');
                lightbox.setAttribute('aria-hidden', 'true');
                big.removeAttribute('src');
                document.body.style.overflow = '';
            }

            proofImages.forEach(function (img) {
                var wrapper = img.closest('.visual');
                if (wrapper) wrapper.classList.add('zoomable-wrap');
                img.addEventListener('click', function () {
                    big.src = img.currentSrc || img.src;
                    big.alt = img.alt || 'Expanded proof';
                    lightbox.classList.add('open');
                    lightbox.setAttribute('aria-hidden', 'false');
                    document.body.style.overflow = 'hidden';
                });
            });
            close.addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', function (event) {
                if (event.target === lightbox) closeLightbox();
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
            });
        }

        var storageKey = 'sk_ep_preview1';
        var dismissed = false;
        try { dismissed = sessionStorage.getItem(storageKey) === 'dismissed'; } catch (e) {}
        if (!dismissed) {
            var modal = document.createElement('div');
            modal.className = 'sk-ep';
            modal.id = 'sk-preview-ep';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = '' +
                '<div class="sk-ep-card" role="dialog" aria-modal="true" aria-labelledby="sk-ep-title">' +
                '<button class="sk-ep-close" type="button" aria-label="Close">×</button>' +
                '<div class="sk-ep-kicker">Before you go</div>' +
                '<h3 id="sk-ep-title">Get the free improvement plan every coaching student starts with.</h3>' +
                '<p>No strings. Sent to your inbox instantly.</p>' +
                '<form class="sk-ep-form" action="https://app.convertkit.com/forms/9535572/subscriptions" method="post">' +
                '<input type="email" name="email_address" autocomplete="email" placeholder="Your email" required>' +
                '<button class="btn" type="submit">Send My Plan</button>' +
                '</form>' +
                '<div class="sk-ep-success">Check your inbox. Your improvement plan is on the way.</div>' +
                '</div>';
            document.body.appendChild(modal);

            var closeModal = modal.querySelector('.sk-ep-close');
            var form = modal.querySelector('form');
            var hasShown = false;

            function openModal() {
                if (hasShown) return;
                hasShown = true;
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
            }
            function dismissModal() {
                modal.classList.remove('open');
                modal.setAttribute('aria-hidden', 'true');
                try { sessionStorage.setItem(storageKey, 'dismissed'); } catch (e) {}
            }

            closeModal.addEventListener('click', dismissModal);
            modal.addEventListener('click', function (event) {
                if (event.target === modal) dismissModal();
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && modal.classList.contains('open')) dismissModal();
            });

            if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
                document.addEventListener('mouseleave', function (event) {
                    if (event.clientY <= 10) openModal();
                });
            } else {
                window.setTimeout(openModal, 30000);
            }

            window.SK_openFreePlanPreview = openModal;

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var data = new FormData(form);
                fetch(form.action, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: data
                }).then(function () {
                    modal.setAttribute('data-state', 'success');
                    try { localStorage.setItem(storageKey + '_subscribed', String(Date.now())); } catch (e) {}
                }).catch(function () {
                    modal.setAttribute('data-state', 'success');
                });
            });
        }
    });
})();
