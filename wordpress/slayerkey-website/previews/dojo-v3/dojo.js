(function () {
    'use strict';

    var pendingPlanTrigger = null;

    function installFinalPolishStyles() {
        var previous = document.getElementById('dojoFinalPolishStyles');
        if (previous && previous.parentNode) previous.parentNode.removeChild(previous);

        var style = document.createElement('style');
        style.id = 'dojoFinalPolishStyles';
        style.textContent = '' +
            '#sk-std .dj-hero .dj-cta-note,#sk-std .dj-final .dj-cta-note{display:none!important}' +
            '#sk-std .dj-proofline{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 18px!important;align-items:start;margin-top:26px!important;padding-top:20px!important}' +
            '#sk-std .dj-proofline span{display:grid;grid-template-columns:18px minmax(0,1fr);gap:7px;align-items:start;min-width:0;padding:2px 0;line-height:1.38}' +
            '#sk-std .dj-proofline span:before{margin-right:0!important;text-align:center}' +
            '#sk-std .dj-proof-featured,#sk-std .dj-proof-static{display:flex;flex-direction:column}' +
            '#sk-std .dj-proof-image{order:1}' +
            '#sk-std .dj-proof-summary{order:2;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:18px 18px 20px!important;border-top:1px solid rgba(255,255,255,.09)!important;border-bottom:0!important;background:linear-gradient(180deg,rgba(40,223,203,.055),rgba(7,18,27,.94))!important;text-align:center!important}' +
            '#sk-std .dj-proof-summary small{display:block;color:#fff!important;font-size:1.02rem!important;font-weight:900!important;letter-spacing:.045em!important;line-height:1.25!important;text-align:center!important;text-transform:uppercase}' +
            '#sk-std .dj-proof-summary strong{display:block;color:var(--dj-teal)!important;font-size:.86rem!important;font-weight:900!important;letter-spacing:.035em!important;line-height:1.3!important;text-align:center!important;text-transform:uppercase}' +
            '#sk-std .dj-proof-featured .dj-proof-summary{padding:21px 22px 23px!important}' +
            '#sk-std .dj-proof-featured .dj-proof-summary small{font-size:1.28rem!important}' +
            '#sk-std .dj-proof-featured .dj-proof-summary strong{font-size:.98rem!important}' +
            '#sk-std .dj-proof-player{display:block;color:#8fa0ac;font-size:.62rem;font-weight:900;letter-spacing:.14em;line-height:1.2;text-align:center;text-transform:uppercase}' +
            '#sk-std .dj-proof-featured .dj-proof-player{font-size:.68rem}' +
            '#sk-std .dj-proof-note{display:none!important}' +
            '#sk-std .dj-diagnosis-card small{line-height:1.35}' +
            '#sk-std .dj-diagnosis-card>p{max-width:720px}' +
            '#sk-std .dj-includes strong{line-height:1.42}' +
            '#sk-std .dj-faq summary{position:relative;padding-right:32px;line-height:1.35}' +
            '#sk-std .dj-faq summary:after{position:absolute;right:0;top:50%;float:none;transform:translateY(-50%)}' +
            '@media(max-width:1040px){#sk-std .dj-proofline{grid-template-columns:repeat(2,minmax(0,1fr))!important}#sk-std .dj-proofline span:last-child{grid-column:1/-1;max-width:360px}}' +
            '@media(max-width:900px){#sk-std .dj-proof-featured .dj-proof-summary small{font-size:1.16rem!important}#sk-std .dj-proof-featured .dj-proof-summary strong{font-size:.92rem!important}#sk-std .dj-proof-summary small{font-size:1.08rem!important}#sk-std .dj-proof-summary strong{font-size:.9rem!important}}' +
            '@media(max-width:700px){#sk-std .dj-proofline{grid-template-columns:1fr!important;gap:10px!important;margin-top:22px!important;padding-top:17px!important}#sk-std .dj-proofline span:last-child{grid-column:auto;max-width:none}#sk-std .dj-proof-summary{align-items:center!important;padding:16px 15px 18px!important}#sk-std .dj-proof-summary small,#sk-std .dj-proof-summary strong{text-align:center!important}#sk-std .dj-proof-featured .dj-proof-summary{padding:18px 15px 20px!important}}' +
            '@media(max-width:430px){#sk-std .dj-proof-summary small{font-size:.92rem!important;letter-spacing:.025em!important}#sk-std .dj-proof-summary strong{font-size:.8rem!important;letter-spacing:.02em!important}#sk-std .dj-proof-featured .dj-proof-summary small{font-size:1rem!important}#sk-std .dj-proof-featured .dj-proof-summary strong{font-size:.84rem!important}}';
        document.head.appendChild(style);
    }

    installFinalPolishStyles();

    function isDirectPlanLink(link) {
        if (!link) return false;
        if (link.getAttribute('data-sk-plan-direct') === 'true') return true;
        var location = link.getAttribute('data-sk-location') || '';
        return location === 'pricing_monthly' || location === 'pricing_annual';
    }

    /* Generic Start Improving actions are intercepted in capture phase. Their authored href is
       already #pricing, so even a click before this file finishes loading can never choose Monthly. */
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

        /* Final customer-facing polish. Keep plan timing in pricing/chooser/FAQ, not feature cards. */
        (function applyFinalPolishCopy() {
            var heroLead = root.querySelector('.dj-hero .lead');
            if (heroLead) heroLead.textContent = 'Stop guessing what to work on. Get a clear plan, personal feedback, and a month by month roadmap so you always know what to focus on next.';

            Array.prototype.slice.call(root.querySelectorAll('.dj-hero .dj-cta-note,.dj-final .dj-cta-note')).forEach(function (note) {
                if (note.parentNode) note.parentNode.removeChild(note);
            });

            var proofIntro = root.querySelector('#proof .dj-kicker-copy');
            if (proofIntro) proofIntro.textContent = 'Real results from players Slayerkey has coached, trained, and helped improve. Open any screenshot to see the original proof.';

            var proofNames = ['Lazy', 'Darkblood', 'Chrake', 'G09'];
            Array.prototype.forEach.call(root.querySelectorAll('.dj-proof-summary'), function (summary, index) {
                if (!proofNames[index] || summary.querySelector('.dj-proof-player')) return;
                var player = document.createElement('span');
                player.className = 'dj-proof-player';
                player.textContent = proofNames[index];
                summary.insertBefore(player, summary.firstChild);
            });

            var proofNote = root.querySelector('.dj-proof-note');
            if (proofNote && proofNote.parentNode) proofNote.parentNode.removeChild(proofNote);

            var mechanism = root.querySelector('#how-it-works');
            if (mechanism) {
                var mechanismIntro = mechanism.querySelector('.dj-kicker-copy');
                if (mechanismIntro) mechanismIntro.textContent = 'The Dojo helps you find the biggest problem in your game, fix it, then move on to the next one. You are not paying to wander through a giant library.';

                var mechanismCards = mechanism.querySelectorAll('.dj-mech-step');
                if (mechanismCards[1]) {
                    var priorityHeading = mechanismCards[1].querySelector('h3');
                    var priorityBody = mechanismCards[1].querySelector('p');
                    if (priorityHeading) priorityHeading.textContent = 'Prioritize';
                    if (priorityBody) priorityBody.textContent = 'Figure out what matters most and turn it into a clear focus, routine, or next step.';
                }
                if (mechanismCards[5]) {
                    var repeatBody = mechanismCards[5].querySelector('p');
                    if (repeatBody) repeatBody.textContent = 'Keep fixing the biggest thing holding you back, then move to the next one.';
                }
            }

            var diagnosis = root.querySelector('#diagnosis');
            if (diagnosis) {
                var diagnosisHeading = diagnosis.querySelector('.dj-section-head h2');
                var diagnosisIntro = diagnosis.querySelector('.dj-section-head>p');
                if (diagnosisHeading) diagnosisHeading.innerHTML = 'Get Personal Direction <span class="gradient-text">At Every Stage.</span>';
                if (diagnosisIntro) diagnosisIntro.textContent = 'Start with a personal Tracker Review, weekly coaching, and daily feedback. As you progress, deeper mechanics and VOD reviews give you increasingly specific corrections. Annual unlocks both personal reviews immediately.';

                var cards = diagnosis.querySelectorAll('.dj-diagnosis-card');
                var labels = [
                    'Available From The Start',
                    'Available From The Start',
                    'Personal Progression Milestone',
                    'Advanced Progression Milestone'
                ];
                var bodies = [
                    'Your Tracker and habits are reviewed for things like volume, agent consistency, filling, switching, Deathmatch usage, and obvious patterns that are slowing improvement.',
                    'Bring questions, problems, and what you are working on into weekly coaching, then use daily feedback and community help to stay corrected while you apply the roadmap.',
                    'Submit Deathmatch gameplay. Slayerkey identifies the mechanical weaknesses that actually matter, explains why, and gives you the drills, routines, resources, and priorities to fix them.',
                    'Submit one of your real games for a dedicated recorded breakdown of the decisions, rounds, mistakes, and patterns that matter, plus actionable notes and clear improvement priorities.'
                ];
                Array.prototype.forEach.call(cards, function (card, index) {
                    var label = card.querySelector('small');
                    var body = card.querySelector(':scope > p:not(.dj-diagnosis-outcome)');
                    if (label && labels[index]) label.textContent = labels[index];
                    if (body && bodies[index]) body.textContent = bodies[index];
                });
            }

            var trainingCopy = root.querySelector('#inside .dj-section-head>p');
            if (trainingCopy) trainingCopy.textContent = '100+ lessons and roughly 50 hours of training across mechanics, agents, maps, game sense, mentality, reviews, and analysis give you the resources to work on the problem that matters right now.';

            var monthlyPriceButton = root.querySelector('[data-sk-location="pricing_monthly"]');
            var annualPriceButton = root.querySelector('[data-sk-location="pricing_annual"]');
            if (monthlyPriceButton) monthlyPriceButton.textContent = 'Join Monthly';
            if (annualPriceButton) annualPriceButton.textContent = 'Join Annual';
        })();

        /* Reveal behavior, with reduced motion respected. */
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

        /* The paid Dojo experience must not compete with any automatic free email offer.
           Remove both the old shared preview modal and the retired Dojo-specific modal if another
           script injects either one later. */
        (function suppressAutomaticEmailCapture() {
            function removeEmailCapture() {
                ['sk-preview-ep', 'sk-dojo-ep'].forEach(function (id) {
                    var emailModal = document.getElementById(id);
                    if (emailModal && emailModal.parentNode) emailModal.parentNode.removeChild(emailModal);
                });
            }
            removeEmailCapture();
            if ('MutationObserver' in window && document.body) {
                var emailObserver = new MutationObserver(removeEmailCapture);
                emailObserver.observe(document.body, { childList: true, subtree: true });
            }
        })();

        /* Current Dojo VSL: autoplay muted, then make sound opt-in unmistakable. */
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

        /* Header CTAs use the same safe fallback and the same chooser as the page CTAs. */
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

        /* One and only one plan chooser. Monthly remains visibly first on mobile so the page never
           accidentally communicates that entry starts at $199.99. */
        (function installPlanChooser() {
            var monthlyCheckout = 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=plan_chooser_monthly';
            var annualCheckout = 'https://whop.com/checkout/plan_kaaoYadRlBi4n/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=plan_chooser_annual';
            var chooserVersion = 'dojo-plan-chooser-final-copy';

            Array.prototype.slice.call(document.querySelectorAll('#sk-plan-chooser')).forEach(function (existing) {
                if (existing.parentNode) existing.parentNode.removeChild(existing);
            });
            var staleStyles = document.getElementById('dojoPlanChooserStyles');
            if (staleStyles && staleStyles.parentNode) staleStyles.parentNode.removeChild(staleStyles);

            var styles = document.createElement('style');
            styles.id = 'dojoPlanChooserStyles';
            styles.setAttribute('data-sk-chooser-version', chooserVersion);
            styles.textContent = '' +
                '.sk-plan-modal{position:fixed;inset:0;z-index:100020;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,5,9,.84);backdrop-filter:blur(14px)}' +
                '.sk-plan-modal.open{display:flex}.sk-plan-shell{position:relative;width:min(900px,100%);max-height:min(780px,calc(100vh - 36px));overflow:auto;padding:31px 30px 30px;background:linear-gradient(180deg,#0d1c28,#08131c);border:1px solid rgba(255,255,255,.13);box-shadow:0 34px 120px rgba(0,0,0,.66);color:#f7fbff}' +
                '.sk-plan-close{position:absolute;right:13px;top:13px;display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:#07121b;color:#9fb0bb;font-size:1.05rem;line-height:1;cursor:pointer}.sk-plan-close:hover{color:#fff;border-color:rgba(255,255,255,.3)}' +
                '.sk-plan-head{text-align:center;max-width:710px;margin:0 auto 24px;padding:0 36px}.sk-plan-head h3{margin:0;color:#fff;font-family:var(--font-display,Arial Black,Impact,sans-serif);font-size:clamp(1.9rem,4vw,3rem);font-weight:900;line-height:.96;text-transform:uppercase}.sk-plan-head p{margin:12px auto 0;color:#9fb0bb;font-size:.9rem;line-height:1.45}.sk-plan-head strong{color:#fff}' +
                '.sk-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}.sk-plan-card{position:relative;display:flex;flex-direction:column;align-items:center;min-height:430px;padding:25px;border:1px solid rgba(255,255,255,.13);background:#08141d;text-align:center}.sk-plan-card.annual{border-color:rgba(44,224,204,.72);background:linear-gradient(180deg,rgba(15,35,43,.99),rgba(7,20,29,.99));box-shadow:0 25px 70px rgba(0,0,0,.35),0 0 36px rgba(44,224,204,.08)}.sk-plan-card.annual:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,#2ce0cc,transparent)}' +
                '.sk-plan-badge{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:6px 10px;border:1px solid rgba(44,224,204,.32);background:rgba(44,224,204,.08);color:#2ce0cc;font-size:.62rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.sk-plan-badge.placeholder{visibility:hidden}' +
                '.sk-plan-name{margin-top:13px;color:#fff;font-size:.8rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.sk-plan-price{margin-top:8px;color:#fff;font-family:var(--font-display,Arial Black,Impact,sans-serif);font-size:3rem;font-weight:900;line-height:1}.sk-plan-price span{font-family:var(--font-body,Inter,Arial,sans-serif);font-size:.78rem;font-weight:800;color:#9fb0bb}.sk-plan-save{margin-top:9px;color:#2ce0cc;font-size:.78rem;font-weight:900}' +
                '.sk-plan-list{display:grid;align-content:start;justify-items:stretch;gap:11px;width:min(100%,340px);margin:23px auto 24px;padding:0;list-style:none;color:#cbd6dc;font-size:.8rem;line-height:1.4;text-align:left}.sk-plan-list li{display:grid;grid-template-columns:18px minmax(0,1fr);align-items:start;gap:8px;width:100%;text-align:left}.sk-plan-list li:before{content:"✓";grid-column:1;justify-self:center;color:#2ce0cc;font-weight:900}.sk-plan-list strong{color:#fff}' +
                '.sk-plan-action{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:auto;padding:0 17px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(135deg,#ff596c,#ff4655);color:#fff!important;font-size:.77rem;font-weight:900;letter-spacing:.05em;text-align:center;text-decoration:none;text-transform:uppercase;box-shadow:0 14px 34px rgba(255,70,85,.18);transition:transform .18s ease,filter .18s ease}.sk-plan-action:hover{transform:translateY(-2px);filter:brightness(1.05)}.sk-plan-card.annual .sk-plan-action{background:linear-gradient(135deg,#23cdbb,#2ce0cc);color:#041014!important;box-shadow:0 14px 34px rgba(44,224,204,.14)}' +
                '@media(max-width:700px){.sk-plan-modal{align-items:flex-start;padding:8px}.sk-plan-shell{width:100%;max-height:calc(100dvh - 16px);padding:48px 14px 16px}.sk-plan-grid{grid-template-columns:1fr}.sk-plan-card{min-height:0;padding:22px 18px}.sk-plan-head{padding:0 7px;margin-bottom:18px}.sk-plan-head h3{font-size:clamp(1.8rem,10vw,2.45rem)}.sk-plan-head p{font-size:.82rem}.sk-plan-price{font-size:2.7rem}.sk-plan-list{width:min(100%,320px);margin:20px auto 22px}.sk-plan-action{margin-top:8px}.sk-plan-close{right:10px;top:10px}}';
            document.head.appendChild(styles);

            var modal = document.createElement('div');
            modal.className = 'sk-plan-modal';
            modal.id = 'sk-plan-chooser';
            modal.setAttribute('data-sk-chooser-version', chooserVersion);
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = '' +
                '<div class="sk-plan-shell" role="dialog" aria-modal="true" aria-labelledby="sk-plan-title">' +
                '<button class="sk-plan-close" type="button" aria-label="Close plan chooser">✕</button>' +
                '<div class="sk-plan-head">' +
                '<h3 id="sk-plan-title">How Do You Want To Start?</h3>' +
                '<p><strong>Full Dojo access starts at $19.99/month.</strong> Annual saves two months and unlocks both your Personal Mechanics Analysis and Personal VOD Review immediately.</p>' +
                '</div>' +
                '<div class="sk-plan-grid">' +
                '<article class="sk-plan-card monthly">' +
                '<div class="sk-plan-badge placeholder" aria-hidden="true">Complete Dojo</div>' +
                '<div class="sk-plan-name">Monthly</div>' +
                '<div class="sk-plan-price">$19.99 <span>/ month</span></div>' +
                '<ul class="sk-plan-list"><li><strong>Complete Dojo access</strong></li><li>7 Day Improvement Plan + Monthly Roadmap</li><li>Personal Tracker Reviews</li><li>Weekly Coaching + Daily Feedback</li><li>Mechanics Analysis + Personal VOD Review unlock as you progress</li></ul>' +
                '<a class="sk-plan-action" href="' + monthlyCheckout + '" target="_blank" rel="noopener" data-sk-cta="dojo-plan-monthly" data-sk-checkout="true" data-sk-offer="dojo" data-sk-location="plan_chooser_monthly" data-sk-plan-direct="true">Join Monthly</a>' +
                '</article>' +
                '<article class="sk-plan-card annual">' +
                '<div class="sk-plan-badge">Best Value</div>' +
                '<div class="sk-plan-name">Annual</div>' +
                '<div class="sk-plan-price">$199.99 <span>/ year</span></div>' +
                '<div class="sk-plan-save">2 months free</div>' +
                '<ul class="sk-plan-list"><li><strong>Everything in Monthly</strong></li><li><strong>Personal Mechanics Analysis immediately</strong></li><li><strong>Personal VOD Review immediately</strong></li><li>Custom routine, drills, resources, and priorities immediately</li></ul>' +
                '<a class="sk-plan-action" href="' + annualCheckout + '" target="_blank" rel="noopener" data-sk-cta="dojo-plan-annual" data-sk-checkout="true" data-sk-offer="dojo" data-sk-location="plan_chooser_annual" data-sk-plan-direct="true">Join Annual</a>' +
                '</article>' +
                '</div>' +
                '</div>';
            document.body.appendChild(modal);

            var closeButton = modal.querySelector('.sk-plan-close');
            var lastTrigger = null;

            function ensureCurrentChooser() {
                if (!styles.parentNode && document.head) document.head.appendChild(styles);
                if (!modal.parentNode && document.body) document.body.appendChild(modal);

                Array.prototype.slice.call(document.querySelectorAll('#sk-plan-chooser')).forEach(function (candidate) {
                    if (candidate !== modal && candidate.parentNode) candidate.parentNode.removeChild(candidate);
                });
                Array.prototype.slice.call(document.querySelectorAll('#dojoPlanChooserStyles')).forEach(function (candidate) {
                    if (candidate !== styles && candidate.parentNode) candidate.parentNode.removeChild(candidate);
                });
                window.SK_openDojoPlanChooser = openChooser;
            }

            function openChooser(trigger) {
                lastTrigger = trigger || document.activeElement;
                ensureCurrentChooser();
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

            /* If an older cached implementation appears later, restore this exact chooser instead
               of inheriting a mixed state or allowing the current UI to disappear. */
            if ('MutationObserver' in window && document.documentElement) {
                var chooserObserver = new MutationObserver(function () {
                    ensureCurrentChooser();
                });
                chooserObserver.observe(document.documentElement, { childList: true, subtree: true });
            }

            window.SK_openDojoPlanChooser = openChooser;
            if (pendingPlanTrigger) {
                var trigger = pendingPlanTrigger;
                pendingPlanTrigger = null;
                openChooser(trigger);
            }
        })();

        /* One continuous review rail owner. */
        (function installReviewRail() {
            var oldRail = root.querySelector('.dj-review-rail');
            if (!oldRail || !oldRail.parentNode || !window.requestAnimationFrame) return;

            var rail = oldRail.cloneNode(true);
            rail.classList.add('show');
            oldRail.parentNode.replaceChild(rail, oldRail);

            var track = rail.querySelector('.dj-review-track');
            if (!track) return;

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
            var lightboxClose = lightbox.querySelector('.dj-lightbox-close');
            var lightboxTrigger = null;

            function closeLightbox() {
                lightbox.classList.remove('open');
                lightbox.setAttribute('aria-hidden', 'true');
                if (lightboxImage) lightboxImage.removeAttribute('src');
                document.body.style.overflow = '';
                if (lightboxTrigger && typeof lightboxTrigger.focus === 'function') lightboxTrigger.focus();
            }

            Array.prototype.slice.call(root.querySelectorAll('[data-proof-src]')).forEach(function (trigger) {
                trigger.addEventListener('click', function () {
                    if (!lightboxImage) return;
                    lightboxTrigger = trigger;
                    lightboxImage.src = trigger.getAttribute('data-proof-src');
                    var childImage = trigger.querySelector('img');
                    lightboxImage.alt = childImage && childImage.alt ? childImage.alt : 'Expanded proof';
                    lightbox.classList.add('open');
                    lightbox.setAttribute('aria-hidden', 'false');
                    document.body.style.overflow = 'hidden';
                    window.setTimeout(function () { if (lightboxClose) lightboxClose.focus(); }, 0);
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
    });
})();

/* Lightweight post-launch presentation polish: no new sales architecture or interaction owner. */
(function () {
    'use strict';

    function applyPostLaunchPolish() {
        var root = document.getElementById('sk-std');
        if (!root) return;

        var oldStyle = document.getElementById('dojoPostLaunchPolishStyles');
        if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);

        var style = document.createElement('style');
        style.id = 'dojoPostLaunchPolishStyles';
        style.textContent = '' +
            '#sk-std .reveal{opacity:0!important;transform:translate3d(0,28px,0) scale(.985)!important;filter:none!important;transition:opacity .72s cubic-bezier(.16,1,.3,1),transform .72s cubic-bezier(.16,1,.3,1)!important}' +
            '#sk-std .reveal.show,#sk-std .reveal.is-visible{opacity:1!important;transform:translate3d(0,0,0) scale(1)!important;filter:none!important}' +
            '#sk-std #pricing .dj-value-box{grid-template-columns:minmax(0,.7fr) minmax(540px,1.3fr)!important;align-items:start!important;padding:34px!important}' +
            '#sk-std #pricing .dj-checks,#sk-std #pricing .dj-pricing-note{display:none!important}' +
            '#sk-std #pricing .dj-plan-options .dj-price-card{height:auto!important;min-height:360px!important;padding:22px!important}' +
            '#sk-std #pricing .dj-pricing-list{gap:8px!important;margin:18px 0 20px!important}' +
            '#sk-std #pricing .dj-body-copy{margin-top:14px!important}' +
            '.sk-plan-card{min-height:390px!important}' +
            '.sk-plan-list{gap:9px!important;margin:20px auto 22px!important}' +
            '@media(max-width:1050px){#sk-std #pricing .dj-value-box{grid-template-columns:1fr!important}}' +
            '@media(max-width:700px){#sk-std #pricing .dj-value-box{padding:24px 18px!important}.sk-plan-card{min-height:0!important}}' +
            '@media(prefers-reduced-motion:reduce){#sk-std .reveal{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}}';
        document.head.appendChild(style);

        var pricing = root.querySelector('#pricing');
        if (pricing) {
            var pricingCopy = pricing.querySelector('.dj-body-copy');
            if (pricingCopy) pricingCopy.textContent = 'Both plans include the complete Dojo. Start Monthly for full access, or choose Annual to save two months and get both personal reviews immediately.';

            var checks = pricing.querySelector('.dj-checks');
            if (checks && checks.parentNode) checks.parentNode.removeChild(checks);
            var note = pricing.querySelector('.dj-pricing-note');
            if (note && note.parentNode) note.parentNode.removeChild(note);

            var pricingCards = pricing.querySelectorAll('.dj-price-card');
            if (pricingCards[0]) {
                var monthlyList = pricingCards[0].querySelector('.dj-pricing-list');
                if (monthlyList) monthlyList.innerHTML = '<li><strong>Complete Dojo access</strong></li><li>7 Day Improvement Plan + Monthly Roadmap</li><li>Tracker reviews + weekly coaching</li><li>Daily feedback + private teams + accountability</li><li>100+ lessons + training library</li>';
            }
            if (pricingCards[1]) {
                var annualList = pricingCards[1].querySelector('.dj-pricing-list');
                if (annualList) annualList.innerHTML = '<li><strong>Everything in Monthly</strong></li><li><strong>Personal Mechanics Analysis immediately</strong></li><li><strong>Personal VOD Review immediately</strong></li><li>Custom routine + improvement priorities immediately</li>';
            }
        }

        var chooser = document.getElementById('sk-plan-chooser');
        if (chooser) {
            var chooserCards = chooser.querySelectorAll('.sk-plan-card');
            if (chooserCards[0]) {
                var chooserMonthly = chooserCards[0].querySelector('.sk-plan-list');
                if (chooserMonthly) chooserMonthly.innerHTML = '<li><strong>Complete Dojo access</strong></li><li>7 Day Improvement Plan + Monthly Roadmap</li><li>Tracker reviews + weekly coaching</li><li>Daily feedback + private teams + accountability</li><li>100+ lessons + training library</li>';
            }
            if (chooserCards[1]) {
                var chooserAnnual = chooserCards[1].querySelector('.sk-plan-list');
                if (chooserAnnual) chooserAnnual.innerHTML = '<li><strong>Everything in Monthly</strong></li><li><strong>Personal Mechanics Analysis immediately</strong></li><li><strong>Personal VOD Review immediately</strong></li><li>Custom routine + improvement priorities immediately</li>';
            }
        }

        var faq = root.querySelector('#faq .dj-faq');
        if (faq) {
            var keep = {
                'Is this for my rank?': true,
                'Is this just another Discord server?': true,
                'What happens after I join?': true,
                'What is the difference between Monthly and Annual?': true,
                'Why would I buy this instead of watching free YouTube videos?': true
            };

            Array.prototype.slice.call(faq.querySelectorAll('details')).forEach(function (item) {
                var summary = item.querySelector('summary');
                var title = summary ? summary.textContent.trim() : '';
                if (!keep[title]) {
                    if (item.parentNode) item.parentNode.removeChild(item);
                    return;
                }

                if (title === 'Is this for my rank?') {
                    var answer = item.querySelector('p');
                    if (answer) answer.textContent = 'Yes. The process is built around finding the next problem in your games, regardless of where you are starting. The priority changes with the player; the Diagnose → Prioritize → Train → Apply → Review → Repeat loop does not.';
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPostLaunchPolish, { once: true });
    } else {
        applyPostLaunchPolish();
    }
})();
