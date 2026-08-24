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

        /* Plan chooser. Generic Start Improving CTAs open this instead of silently choosing Monthly. */
        (function installPlanChooser() {
            var monthlyCheckout = 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=plan_chooser_monthly';
            var annualCheckout = 'https://whop.com/checkout/plan_kaaoYadRlBi4n/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=plan_chooser_annual';

            if (!document.getElementById('dojoPlanChooserStyles')) {
                var styles = document.createElement('style');
                styles.id = 'dojoPlanChooserStyles';
                styles.textContent = '' +
                    '.sk-plan-modal{position:fixed;inset:0;z-index:100020;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,5,9,.82);backdrop-filter:blur(14px)}' +
                    '.sk-plan-modal.open{display:flex}.sk-plan-shell{position:relative;width:min(900px,100%);max-height:min(780px,calc(100vh - 36px));overflow:auto;padding:30px;background:linear-gradient(180deg,#0d1c28,#08131c);border:1px solid rgba(255,255,255,.13);box-shadow:0 34px 120px rgba(0,0,0,.66);color:#f7fbff}' +
                    '.sk-plan-close{position:absolute;right:13px;top:13px;width:38px;height:38px;border:1px solid rgba(255,255,255,.13);background:#07121b;color:#9fb0bb;font-size:1.05rem;cursor:pointer}.sk-plan-close:hover{color:#fff;border-color:rgba(255,255,255,.3)}' +
                    '.sk-plan-head{text-align:center;max-width:650px;margin:0 auto 24px}.sk-plan-kicker{color:#2ce0cc;font-size:.66rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.sk-plan-head h3{margin:8px 0 0;color:#fff;font-family:var(--font-display,Arial Black,Impact,sans-serif);font-size:clamp(1.9rem,4vw,3rem);font-weight:900;line-height:.96;text-transform:uppercase}.sk-plan-head p{margin:10px auto 0;color:#9fb0bb;font-size:.9rem;line-height:1.5}' +
                    '.sk-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}.sk-plan-card{position:relative;display:flex;flex-direction:column;min-height:430px;padding:25px;border:1px solid rgba(255,255,255,.13);background:#08141d}.sk-plan-card.annual{transform:translateY(-7px);border-color:rgba(44,224,204,.72);background:linear-gradient(180deg,rgba(15,35,43,.99),rgba(7,20,29,.99));box-shadow:0 25px 70px rgba(0,0,0,.35),0 0 36px rgba(44,224,204,.08)}.sk-plan-card.annual:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,#2ce0cc,transparent)}' +
                    '.sk-plan-badge{align-self:flex-start;min-height:26px;padding:6px 9px;border:1px solid rgba(255,255,255,.12);color:#c7d3da;font-size:.62rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.sk-plan-card.annual .sk-plan-badge{border-color:rgba(44,224,204,.32);background:rgba(44,224,204,.08);color:#2ce0cc}' +
                    '.sk-plan-name{margin-top:16px;color:#fff;font-size:.77rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.sk-plan-price{margin-top:7px;color:#fff;font-family:var(--font-display,Arial Black,Impact,sans-serif);font-size:3rem;font-weight:900;line-height:1}.sk-plan-price span{font-family:var(--font-body,Inter,Arial,sans-serif);font-size:.78rem;font-weight:800;color:#9fb0bb}.sk-plan-save{margin-top:8px;color:#2ce0cc;font-size:.76rem;font-weight:900}' +
                    '.sk-plan-list{display:grid;gap:10px;margin:21px 0 0;padding:0;list-style:none;color:#cbd6dc;font-size:.83rem;line-height:1.45}.sk-plan-list li:before{content:"✓";margin-right:8px;color:#2ce0cc;font-weight:900}.sk-plan-personal{margin-top:18px;padding:15px;border:1px solid rgba(44,224,204,.24);background:rgba(44,224,204,.055)}.sk-plan-personal strong{display:block;color:#fff;font-size:.88rem;line-height:1.3}.sk-plan-personal span{display:block;margin-top:6px;color:#b9c8d0;font-size:.78rem;line-height:1.45}' +
                    '.sk-plan-action{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:auto;padding:0 17px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(135deg,#ff596c,#ff4655);color:#fff!important;font-size:.77rem;font-weight:900;letter-spacing:.05em;text-align:center;text-decoration:none;text-transform:uppercase;box-shadow:0 14px 34px rgba(255,70,85,.18);transition:transform .18s ease,filter .18s ease}.sk-plan-action:hover{transform:translateY(-2px);filter:brightness(1.05)}.sk-plan-card.annual .sk-plan-action{background:linear-gradient(135deg,#23cdbb,#2ce0cc);color:#041014!important;box-shadow:0 14px 34px rgba(44,224,204,.14)}' +
                    '.sk-plan-foot{margin:16px 0 0;text-align:center;color:#738895;font-size:.72rem}' +
                    '#sk-std .dj-annual-bonus{margin:2px 0 14px;padding:12px 13px;border:1px solid rgba(44,224,204,.22);background:rgba(44,224,204,.055);text-align:left}#sk-std .dj-annual-bonus strong{display:block;color:#fff;font-size:.78rem;line-height:1.3}#sk-std .dj-annual-bonus span{display:block;margin-top:4px;color:#aebfc9;font-size:.69rem;line-height:1.42}' +
                    '@media(max-width:700px){.sk-plan-modal{padding:12px}.sk-plan-shell{padding:26px 14px 18px}.sk-plan-grid{grid-template-columns:1fr}.sk-plan-card{min-height:0}.sk-plan-card.annual{transform:none}.sk-plan-head{padding:0 20px}.sk-plan-price{font-size:2.7rem}}';
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
                '<div class="sk-plan-kicker">Choose Your Plan</div>' +
                '<h3 id="sk-plan-title">How Do You Want To Start?</h3>' +
                '<p>Both plans include complete Training Dojo access. Annual saves two months and adds personal onboarding from Slayerkey.</p>' +
                '</div>' +
                '<div class="sk-plan-grid">' +
                '<article class="sk-plan-card monthly">' +
                '<div class="sk-plan-badge">Flexible</div>' +
                '<div class="sk-plan-name">Monthly</div>' +
                '<div class="sk-plan-price">$19.99 <span>/ month</span></div>' +
                '<ul class="sk-plan-list"><li>Complete Training Dojo access</li><li>100+ lessons and training library</li><li>Weekly VOD reviews</li><li>Daily coaching and private teams</li></ul>' +
                '<a class="sk-plan-action" href="' + monthlyCheckout + '" target="_blank" rel="noopener" data-sk-cta="dojo-plan-monthly" data-sk-checkout="true" data-sk-offer="dojo" data-sk-location="plan_chooser_monthly" data-sk-plan-direct="true">Join The Dojo</a>' +
                '</article>' +
                '<article class="sk-plan-card annual">' +
                '<div class="sk-plan-badge">Best Value</div>' +
                '<div class="sk-plan-name">Annual</div>' +
                '<div class="sk-plan-price">$199.99 <span>/ year</span></div>' +
                '<div class="sk-plan-save">2 months free</div>' +
                '<ul class="sk-plan-list"><li>Everything included in Monthly</li><li>Your gameplay + mechanics personally reviewed by Slayerkey</li></ul>' +
                '<div class="sk-plan-personal"><strong>Your Personalized Improvement Plan</strong><span>Custom training routine + clear improvement priorities built from your personal review.</span></div>' +
                '<a class="sk-plan-action" href="' + annualCheckout + '" target="_blank" rel="noopener" data-sk-cta="dojo-plan-annual" data-sk-checkout="true" data-sk-offer="dojo" data-sk-location="plan_chooser_annual" data-sk-plan-direct="true">Get My Improvement Plan</a>' +
                '</article>' +
                '</div>' +
                '<p class="sk-plan-foot">Choose the plan that fits how you want to start improving.</p>' +
                '</div>';
            document.body.appendChild(modal);

            var closeButton = modal.querySelector('.sk-plan-close');
            var lastTrigger = null;

            function openChooser(trigger) {
                lastTrigger = trigger || document.activeElement;
                var emailModal = document.getElementById('sk-dojo-ep');
                if (emailModal) {
                    emailModal.classList.remove('open');
                    emailModal.setAttribute('aria-hidden', 'true');
                }
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

            Array.prototype.slice.call(document.querySelectorAll('[data-sk-checkout="true"]')).forEach(function (link) {
                if (link.getAttribute('data-sk-plan-direct') === 'true') return;
                var location = link.getAttribute('data-sk-location') || '';
                if (location === 'pricing_monthly' || location === 'pricing_annual') return;
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    openChooser(link);
                });
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
                    if (save) save.textContent = 'Best Value · 2 Months Free';
                    if (!annualCard.querySelector('.dj-annual-bonus')) {
                        var bonus = document.createElement('div');
                        bonus.className = 'dj-annual-bonus';
                        bonus.innerHTML = '<strong>Personally reviewed by Slayerkey</strong><span>Gameplay + mechanics review · custom routine · clear improvement priorities</span>';
                        annualCard.insertBefore(bonus, annualButton);
                    }
                }
            }

            window.SK_openDojoPlanChooser = openChooser;
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
