(function () {
    'use strict';

    var pendingPlanTrigger = null;

    function isDirectPlanLink(link) {
        if (!link) return false;
        if (link.getAttribute('data-sk-plan-direct') === 'true') return true;
        var location = link.getAttribute('data-sk-location') || '';
        return location === 'pricing_monthly' || location === 'pricing_annual';
    }

    /* Intercept generic Start Improving clicks in capture phase so no other handler or
       checkout href can win before the chooser is ready. */
    document.addEventListener('click', function (event) {
        if (!event.target || !event.target.closest) return;
        var link = event.target.closest('.sk-cta-btn,.sk-mobile-cta,[data-sk-checkout="true"]');
        if (!link || isDirectPlanLink(link)) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        if (typeof window.SK_openDojoPlanChooser === 'function') {
            window.SK_openDojoPlanChooser(link);
        } else {
            pendingPlanTrigger = link;
        }
    }, true);

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

        /* Let the proof speak for itself instead of framing the page as a coaching portfolio. */
        var proofCopy = root.querySelector('#proof .dj-section-head p');
        if (proofCopy) {
            proofCopy.textContent = 'Different ranks, different goals, same thing: progress that shows up in ranked.';
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

        /* Header and generic page CTAs get a safe non-checkout fallback. The capture handler opens
           the chooser; if JS were interrupted, the fallback only moves to pricing instead of silently
           selecting Monthly. */
        Array.prototype.slice.call(document.querySelectorAll('.sk-cta-btn,.sk-mobile-cta')).forEach(function (link) {
            var mobile = link.classList.contains('sk-mobile-cta');
            var location = mobile ? 'global_header_mobile' : 'global_header_desktop';
            link.href = '#pricing';
            link.removeAttribute('target');
            link.removeAttribute('rel');
            link.setAttribute('data-sk-cta', 'dojo-' + location + '-start');
            link.setAttribute('data-sk-checkout', 'true');
            link.setAttribute('data-sk-offer', 'dojo');
            link.setAttribute('data-sk-location', location);
            if (link.textContent && link.textContent.trim()) link.textContent = 'Start Improving';
        });

        Array.prototype.slice.call(root.querySelectorAll('[data-sk-checkout="true"]')).forEach(function (link) {
            if (isDirectPlanLink(link)) return;
            link.href = '#pricing';
            link.removeAttribute('target');
            link.removeAttribute('rel');
        });

        /* Plan chooser. Generic Start Improving CTAs open this instead of silently choosing Monthly. */
        (function installPlanChooser() {
            var monthlyCheckout = 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=plan_chooser_monthly';
            var annualCheckout = 'https://whop.com/checkout/plan_kaaoYadRlBi4n/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=plan_chooser_annual';

            if (!document.getElementById('dojoPlanChooserStyles')) {
                var styles = document.createElement('style');
                styles.id = 'dojoPlanChooserStyles';
                styles.textContent = '' +
                    '.sk-plan-modal{position:fixed;inset:0;z-index:100020;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,5,9,.82);backdrop-filter:blur(14px)}' +
                    '.sk-plan-modal.open{display:flex}.sk-plan-shell{position:relative;width:min(900px,100%);max-height:min(780px,calc(100vh - 36px));overflow:auto;padding:31px 30px 30px;background:linear-gradient(180deg,#0d1c28,#08131c);border:1px solid rgba(255,255,255,.13);box-shadow:0 34px 120px rgba(0,0,0,.66);color:#f7fbff}' +
                    '.sk-plan-close{position:absolute;right:13px;top:13px;display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:#07121b;color:#9fb0bb;font-size:1.05rem;line-height:1;cursor:pointer}.sk-plan-close:hover{color:#fff;border-color:rgba(255,255,255,.3)}' +
                    '.sk-plan-head{text-align:center;max-width:680px;margin:0 auto 24px;padding:0 36px}.sk-plan-head h3{margin:0;color:#fff;font-family:var(--font-display,Arial Black,Impact,sans-serif);font-size:clamp(1.9rem,4vw,3rem);font-weight:900;line-height:.96;text-transform:uppercase}.sk-plan-head p{margin:12px auto 0;color:#9fb0bb;font-size:.9rem;line-height:1.45}' +
                    '.sk-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}.sk-plan-card{position:relative;display:flex;flex-direction:column;align-items:center;min-height:470px;padding:25px;border:1px solid rgba(255,255,255,.13);background:#08141d;text-align:center}.sk-plan-card.annual{transform:translateY(-6px);border-color:rgba(44,224,204,.72);background:linear-gradient(180deg,rgba(15,35,43,.99),rgba(7,20,29,.99));box-shadow:0 25px 70px rgba(0,0,0,.35),0 0 36px rgba(44,224,204,.08)}.sk-plan-card.annual:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,#2ce0cc,transparent)}' +
                    '.sk-plan-badge{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:6px 10px;border:1px solid rgba(44,224,204,.32);background:rgba(44,224,204,.08);color:#2ce0cc;font-size:.62rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}' +
                    '.sk-plan-name{margin-top:16px;color:#fff;font-size:.8rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.sk-plan-card.monthly .sk-plan-name{margin-top:2px}.sk-plan-price{margin-top:8px;color:#fff;font-family:var(--font-display,Arial Black,Impact,sans-serif);font-size:3rem;font-weight:900;line-height:1}.sk-plan-price span{font-family:var(--font-body,Inter,Arial,sans-serif);font-size:.78rem;font-weight:800;color:#9fb0bb}.sk-plan-save{margin-top:9px;color:#2ce0cc;font-size:.78rem;font-weight:900}' +
                    '.sk-plan-list{display:grid;align-content:start;justify-items:center;gap:10px;width:100%;margin:24px auto 24px;padding:0;list-style:none;color:#cbd6dc;font-size:.8rem;line-height:1.4;text-align:center}.sk-plan-list li{display:flex;align-items:flex-start;justify-content:center;gap:8px;width:min(100%,330px)}.sk-plan-list li:before{content:"✓";flex:0 0 auto;color:#2ce0cc;font-weight:900}.sk-plan-list strong{color:#fff}' +
                    '.sk-plan-action{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:auto;padding:0 17px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(135deg,#ff596c,#ff4655);color:#fff!important;font-size:.77rem;font-weight:900;letter-spacing:.05em;text-align:center;text-decoration:none;text-transform:uppercase;box-shadow:0 14px 34px rgba(255,70,85,.18);transition:transform .18s ease,filter .18s ease}.sk-plan-action:hover{transform:translateY(-2px);filter:brightness(1.05)}.sk-plan-card.annual .sk-plan-action{background:linear-gradient(135deg,#23cdbb,#2ce0cc);color:#041014!important;box-shadow:0 14px 34px rgba(44,224,204,.14)}' +
                    '@media(max-width:700px){.sk-plan-modal{align-items:flex-start;padding:8px}.sk-plan-shell{width:100%;max-height:calc(100dvh - 16px);padding:48px 14px 16px}.sk-plan-grid{grid-template-columns:1fr}.sk-plan-card{min-height:0;padding:22px 18px}.sk-plan-card.annual{order:-1;transform:none}.sk-plan-head{padding:0 8px;margin-bottom:18px}.sk-plan-head h3{font-size:clamp(1.8rem,10vw,2.45rem)}.sk-plan-head p{font-size:.82rem}.sk-plan-price{font-size:2.7rem}.sk-plan-list{margin:20px auto 22px}.sk-plan-action{margin-top:8px}.sk-plan-close{right:10px;top:10px}}';
                document.head.appendChild(styles);
            }

            var modal = document.createElement('div');
            modal.className = 'sk-plan-modal';
            modal.id = 'sk-plan-chooser';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = '' +
                '<div class="sk-plan-shell" role="dialog" aria-modal="true" aria-labelledby="sk-plan-title">' +
                '<button class="sk-plan-close" type="button" aria-label="Close plan chooser">✕</button>' +
                '<div class="sk-plan-head">' +
                '<h3 id="sk-plan-title">How Do You Want To Start?</h3>' +
                '<p>Monthly gives you the full Dojo. Annual saves two months and adds your personal review.</p>' +
                '</div>' +
                '<div class="sk-plan-grid">' +
                '<article class="sk-plan-card monthly">' +
                '<div class="sk-plan-name">Monthly</div>' +
                '<div class="sk-plan-price">$19.99 <span>/ month</span></div>' +
                '<ul class="sk-plan-list"><li>100+ lessons + training library</li><li>Aim routines</li><li>Tracker reviews</li><li>Weekly VOD reviews</li><li>Daily coaching + private teams</li><li>7 Day Improvement Routine</li><li>Serious improvement focused community</li></ul>' +
                '<a class="sk-plan-action" href="' + monthlyCheckout + '" target="_blank" rel="noopener" data-sk-cta="dojo-plan-monthly" data-sk-checkout="true" data-sk-offer="dojo" data-sk-location="plan_chooser_monthly" data-sk-plan-direct="true">Join The Dojo</a>' +
                '</article>' +
                '<article class="sk-plan-card annual">' +
                '<div class="sk-plan-badge">Best Value</div>' +
                '<div class="sk-plan-name">Annual</div>' +
                '<div class="sk-plan-price">$199.99 <span>/ year</span></div>' +
                '<div class="sk-plan-save">2 months free</div>' +
                '<ul class="sk-plan-list"><li>Everything in Monthly</li><li>Your gameplay + mechanics personally reviewed by Slayerkey</li><li><strong>Personalized Improvement Plan</strong> + custom training routine</li><li>Clear improvement priorities</li></ul>' +
                '<a class="sk-plan-action" href="' + annualCheckout + '" target="_blank" rel="noopener" data-sk-cta="dojo-plan-annual" data-sk-checkout="true" data-sk-offer="dojo" data-sk-location="plan_chooser_annual" data-sk-plan-direct="true">Get My Improvement Plan</a>' +
                '</article>' +
                '</div>' +
                '</div>';
            document.body.appendChild(modal);

            var closeButton = modal.querySelector('.sk-plan-close');
            var lastTrigger = null;

            function closeAnyEmailCapture() {
                ['sk-dojo-ep', 'sk-preview-ep'].forEach(function (id) {
                    var emailModal = document.getElementById(id);
                    if (!emailModal) return;
                    emailModal.classList.remove('open');
                    emailModal.setAttribute('aria-hidden', 'true');
                });
            }

            function openChooser(trigger) {
                lastTrigger = trigger || document.activeElement;
                closeAnyEmailCapture();
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
                window.setTimeout(function () { if (closeButton) closeButton.focus(); }, 0);
            }

            function closeChooser() {
                modal.classList.remove('open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
                if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
            }

            if (closeButton) closeButton.addEventListener('click', closeChooser);
            modal.addEventListener('click', function (event) {
                if (event.target === modal) closeChooser();
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && modal.classList.contains('open')) closeChooser();
            });

            var pricing = root.querySelector('#pricing');
            if (pricing) {
                var monthlyButton = pricing.querySelector('[data-sk-location="pricing_monthly"]');
                var annualButton = pricing.querySelector('[data-sk-location="pricing_annual"]');
                var annualCard = annualButton ? annualButton.closest('.dj-price-card') : null;
                if (monthlyButton) monthlyButton.textContent = 'Join The Dojo';
                if (annualButton) annualButton.textContent = 'Get My Improvement Plan';
                if (annualCard) {
                    var save = annualCard.querySelector('.dj-plan-save');
                    if (save) save.textContent = '2 Months Free';
                    var oldBonus = annualCard.querySelector('.dj-annual-bonus');
                    if (oldBonus && oldBonus.parentNode) oldBonus.parentNode.removeChild(oldBonus);
                }
            }

            window.SK_openDojoPlanChooser = openChooser;
            if (pendingPlanTrigger) {
                var trigger = pendingPlanTrigger;
                pendingPlanTrigger = null;
                openChooser(trigger);
            }
        })();

        /* Replace the visible review rail so the inline scroll loop can only touch a detached node.
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

        /* Keep exactly one free lead capture on the Dojo. It is deliberately named differently from
           the Annual Personalized Improvement Plan so the two offers cannot be confused. */
        (function installEmailCapture() {
            var storageKey = 'sk_ep_preview1';
            var dismissed = false;
            var subscribed = false;
            try { dismissed = sessionStorage.getItem(storageKey) === 'dismissed'; } catch (e) {}
            try { subscribed = !!localStorage.getItem(storageKey + '_subscribed'); } catch (e) {}

            function removeLegacyEmailCapture() {
                var legacy = document.getElementById('sk-preview-ep');
                if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
            }

            removeLegacyEmailCapture();
            if ('MutationObserver' in window && document.body) {
                var legacyObserver = new MutationObserver(removeLegacyEmailCapture);
                legacyObserver.observe(document.body, { childList: true, subtree: true });
            }

            if (dismissed || subscribed || document.getElementById('sk-dojo-ep')) return;

            if (!document.getElementById('dojoEmailCaptureStyles')) {
                var styles = document.createElement('style');
                styles.id = 'dojoEmailCaptureStyles';
                styles.textContent = '' +
                    '.sk-ep{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,5,9,.76);backdrop-filter:blur(12px)}' +
                    '.sk-ep.open{display:flex}.sk-ep-card{width:min(520px,100%);position:relative;padding:34px;background:linear-gradient(180deg,#0d1c28,#08131c);border:1px solid rgba(44,224,204,.28);box-shadow:0 32px 100px rgba(0,0,0,.6);color:#f7fbff}' +
                    '.sk-ep-kicker{font-size:.68rem;text-transform:uppercase;letter-spacing:.16em;font-weight:900;color:#2ce0cc;margin-bottom:10px}.sk-ep h3{margin:0;font-size:1.8rem;line-height:1.02;text-transform:uppercase}.sk-ep p{margin:12px 0 0;color:#c3d0d8}' +
                    '.sk-ep-form{display:flex;gap:9px;margin-top:22px}.sk-ep-form input{flex:1;min-width:0;background:#061019;border:1px solid rgba(255,255,255,.16);color:#fff;padding:0 14px;height:50px;outline:none}.sk-ep-form input:focus{border-color:#2ce0cc}' +
                    '.sk-ep-form .btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 18px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(135deg,#ff5267,#ff4059);color:#fff;font-weight:900;font-size:.78rem;letter-spacing:.055em;text-transform:uppercase;cursor:pointer}' +
                    '.sk-ep-close{position:absolute;right:12px;top:12px;display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;background:transparent;color:#8fa2af;cursor:pointer;font-size:1.15rem;line-height:1}.sk-ep-close:hover{color:#fff}.sk-ep-success{display:none;margin-top:18px;color:#d9fff9;font-weight:800}.sk-ep[data-state="success"] .sk-ep-form{display:none}.sk-ep[data-state="success"] .sk-ep-success{display:block}' +
                    '@media(max-width:620px){.sk-ep{padding:16px}.sk-ep-card{padding:46px 20px 28px}.sk-ep-form{flex-direction:column}.sk-ep-form .btn{width:100%}}';
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
                '<h3 id="sk-ep-title">Get the Free 7 Day Improvement Routine.</h3>' +
                '<p>A simple routine you can start using right away. Sent to your inbox instantly.</p>' +
                '<form class="sk-ep-form" action="https://app.convertkit.com/forms/9535572/subscriptions" method="post">' +
                '<input type="email" name="email_address" autocomplete="email" placeholder="Your email" required>' +
                '<button class="btn" type="submit">Send My Routine</button>' +
                '</form>' +
                '<div class="sk-ep-success">Check your inbox. Your 7 Day Improvement Routine is on the way.</div>' +
                '</div>';
            document.body.appendChild(modal);

            var closeModal = modal.querySelector('.sk-ep-close');
            var form = modal.querySelector('form');
            var hasShown = false;

            function openModal() {
                var planChooser = document.getElementById('sk-plan-chooser');
                if (planChooser && planChooser.classList.contains('open')) return;
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