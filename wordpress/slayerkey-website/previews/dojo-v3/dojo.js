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

        /* Derek was reference material only, not a final community proof card. */
        var derekCard = root.querySelector('[data-proof-src*="std-derekvictory.png"]');
        if (derekCard) derekCard.remove();

        /* Framer-style reveal, with reduced motion respected. */
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var reveals = Array.prototype.slice.call(root.querySelectorAll('.reveal'));
        if (reduceMotion || !('IntersectionObserver' in window)) {
            reveals.forEach(function (el) { el.classList.add('show'); });
        } else {
            var observer = new IntersectionObserver(function (entries, obs) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('show');
                    obs.unobserve(entry.target);
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
            reveals.forEach(function (el) { observer.observe(el); });
        }

        /* Current Dojo VSL: autoplay muted, then make the sound action unmistakable. */
        var iframe = document.getElementById('dojoVideo');
        var unmuteButton = document.getElementById('unmuteBtn');
        if (iframe && unmuteButton) {
            iframe.src = 'https://www.youtube.com/embed/H7hYaHnT6ko?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1';

            function post(command) {
                try {
                    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*');
                } catch (e) {}
            }

            unmuteButton.hidden = false;
            unmuteButton.addEventListener('click', function () {
                post('unMute');
                post('playVideo');
                unmuteButton.hidden = true;
                window.setTimeout(function () {
                    if (iframe.src.indexOf('mute=1') !== -1) {
                        iframe.src = iframe.src.replace('mute=1', 'mute=0');
                    }
                }, 300);
            });
        }

        /* Use the real site's header CTA with preview attribution. */
        Array.prototype.slice.call(document.querySelectorAll('.sk-cta-btn,.sk-mobile-cta')).forEach(function (link) {
            var mobile = link.classList.contains('sk-mobile-cta');
            var location = mobile ? 'global_header_mobile' : 'global_header_desktop';
            link.href = 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=' + location + '_start_improving';
            link.target = '_blank';
            link.rel = 'noopener';
            link.setAttribute('data-sk-cta', 'dojo-' + location + '-start');
            link.setAttribute('data-sk-checkout', 'true');
            link.setAttribute('data-sk-offer', 'dojo');
            link.setAttribute('data-sk-location', location);
            if (link.textContent && link.textContent.trim()) link.textContent = 'Start Improving';
        });

        /* Replace the visible review rail so the older inline scroll loop can only touch a detached node.
           The visible rail uses time modulo cycle width, so there is no accumulated reset delay or pause. */
        (function installReviewRail() {
            var oldRail = root.querySelector('.dj-review-rail');
            if (!oldRail || !oldRail.parentNode || !window.requestAnimationFrame) return;

            var rail = oldRail.cloneNode(true);
            rail.classList.add('show');
            oldRail.parentNode.replaceChild(rail, oldRail);

            var track = rail.querySelector('.dj-review-track');
            if (!track) return;

            rail.style.setProperty('scroll-behavior', 'auto', 'important');
            rail.scrollLeft = 0;
            track.style.setProperty('animation', 'none', 'important');
            track.style.setProperty('transition', 'none', 'important');
            track.style.setProperty('transform', 'translate3d(0,0,0)', 'important');

            var cards = track.children;
            var halfIndex = Math.floor(cards.length / 2);
            if (!cards.length || halfIndex < 1 || !cards[halfIndex]) return;

            var cycleWidth = 0;
            var startTime = performance.now();
            var speed = 48;

            function measure() {
                cycleWidth = cards[halfIndex].offsetLeft - cards[0].offsetLeft;
                startTime = performance.now();
            }

            function move(now) {
                if (cycleWidth > 0) {
                    var phase = (((now - startTime) / 1000) * speed) % cycleWidth;
                    var x = -cycleWidth + phase;
                    track.style.setProperty('transform', 'translate3d(' + x.toFixed(3) + 'px,0,0)', 'important');
                }
                window.requestAnimationFrame(move);
            }

            window.requestAnimationFrame(function () {
                measure();
                window.requestAnimationFrame(move);
            });

            window.addEventListener('resize', measure, { passive: true });
        })();

        /* Full-resolution proof lightbox. */
        var lightbox = document.getElementById('djLightbox');
        if (lightbox) {
            var lightboxImage = lightbox.querySelector('img');
            var closeButton = lightbox.querySelector('.dj-lightbox-close');

            function closeLightbox() {
                lightbox.classList.remove('open');
                lightbox.setAttribute('aria-hidden', 'true');
                if (lightboxImage) lightboxImage.removeAttribute('src');
                document.body.style.overflow = '';
            }

            Array.prototype.slice.call(root.querySelectorAll('[data-proof-src]')).forEach(function (trigger) {
                trigger.addEventListener('click', function () {
                    if (!lightboxImage) return;
                    lightboxImage.src = trigger.getAttribute('data-proof-src');
                    var childImage = trigger.querySelector('img');
                    lightboxImage.alt = childImage && childImage.alt ? childImage.alt : 'Expanded community proof';
                    lightbox.classList.add('open');
                    lightbox.setAttribute('aria-hidden', 'false');
                    document.body.style.overflow = 'hidden';
                });
            });

            if (closeButton) closeButton.addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', function (event) {
                if (event.target === lightbox) closeLightbox();
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
            });
        }

        /* Keep the existing free improvement plan email capture on the Dojo itself.
           Desktop opens on top-edge exit intent. Touch/coarse pointer devices open after 30 seconds. */
        (function installEmailCapture() {
            var storageKey = 'sk_ep_preview1';
            var dismissed = false;
            var subscribed = false;
            try { dismissed = sessionStorage.getItem(storageKey) === 'dismissed'; } catch (e) {}
            try { subscribed = !!localStorage.getItem(storageKey + '_subscribed'); } catch (e) {}
            if (dismissed || subscribed || document.getElementById('sk-preview-ep') || document.getElementById('sk-dojo-ep')) return;

            if (!document.getElementById('dojoEmailCaptureStyles')) {
                var styles = document.createElement('style');
                styles.id = 'dojoEmailCaptureStyles';
                styles.textContent = '' +
                    '.sk-ep{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,5,9,.76);backdrop-filter:blur(12px)}' +
                    '.sk-ep.open{display:flex}.sk-ep-card{width:min(520px,100%);position:relative;padding:34px;background:linear-gradient(180deg,#0d1c28,#08131c);border:1px solid rgba(44,224,204,.28);box-shadow:0 32px 100px rgba(0,0,0,.6);color:#f7fbff}' +
                    '.sk-ep-kicker{font-size:.68rem;text-transform:uppercase;letter-spacing:.16em;font-weight:900;color:#2ce0cc;margin-bottom:10px}.sk-ep h3{margin:0;font-size:1.8rem;line-height:1.02;text-transform:uppercase}.sk-ep p{margin:12px 0 0;color:#c3d0d8}' +
                    '.sk-ep-form{display:flex;gap:9px;margin-top:22px}.sk-ep-form input{flex:1;min-width:0;background:#061019;border:1px solid rgba(255,255,255,.16);color:#fff;padding:0 14px;height:50px;outline:none}.sk-ep-form input:focus{border-color:#2ce0cc}' +
                    '.sk-ep-form .btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 18px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(135deg,#ff5267,#ff4059);color:#fff;font-weight:900;font-size:.78rem;letter-spacing:.055em;text-transform:uppercase;cursor:pointer}' +
                    '.sk-ep-close{position:absolute;right:12px;top:12px;width:36px;height:36px;border:0;background:transparent;color:#8fa2af;cursor:pointer;font-size:1.15rem}.sk-ep-close:hover{color:#fff}.sk-ep-success{display:none;margin-top:18px;color:#d9fff9;font-weight:800}.sk-ep[data-state="success"] .sk-ep-form{display:none}.sk-ep[data-state="success"] .sk-ep-success{display:block}' +
                    '@media(max-width:620px){.sk-ep{padding:16px}.sk-ep-card{padding:28px 20px}.sk-ep-form{flex-direction:column}.sk-ep-form .btn{width:100%}}';
                document.head.appendChild(styles);
            }

            var modal = document.createElement('div');
            modal.className = 'sk-ep';
            modal.id = 'sk-dojo-ep';
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
        })();
    });
})();
