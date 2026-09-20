(function () {
    'use strict';

    function initialize() {
        var root = document.getElementById('sk-std');
        if (!root || root.dataset.dojoInitialized) return;
        root.dataset.dojoInitialized = 'true';

        // An optional enhancement may fail without taking the others down.
        function enhance(fn) {
            try { fn(); } catch (error) {
                console.warn('[Dojo] Optional enhancement unavailable:', error.message);
            }
        }

        function modalController(modal, closeButton) {
            var trigger = null;
            function close() {
                if (!modal.classList.contains('open')) return;
                modal.classList.remove('open');
                modal.hidden = true;
                modal.setAttribute('aria-hidden', 'true');
                // A CSS class owns only our lock; WPCode retains its independent html lock.
                document.body.classList.remove('dojo-dialog-open');
                if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
            }
            closeButton.addEventListener('click', close);
            modal.addEventListener('click', function (event) {
                if (event.target === modal) close();
            });
            modal.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') close();
                if (event.key !== 'Tab') return;
                var focusable = Array.from(modal.querySelectorAll('button,a[href]')).filter(function (el) {
                    return el.getClientRects().length && !el.disabled;
                });
                var first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault(); last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first.focus();
                }
            });
            return {
                close: close,
                open: function (from) {
                    if (!modal.isConnected || !closeButton.isConnected) return false;
                    // Never stack our dialogs or steal focus from an active WPCode dialog.
                    if (document.querySelector('#sk-ep:not([hidden]),#sk-mobile:not([hidden])')) return false;
                    if (document.querySelector('.sk-plan-modal.open,.dj-lightbox.open')) return false;
                    trigger = from || document.activeElement;
                    try {
                        modal.hidden = false;
                        modal.classList.add('open');
                        modal.setAttribute('aria-hidden', 'false');
                        if (!modal.getClientRects().length || !closeButton.getClientRects().length) {
                            close(); return false;
                        }
                        document.body.classList.add('dojo-dialog-open');
                        closeButton.focus({ preventScroll: true });
                        return true;
                    } catch (error) {
                        close(); return false;
                    }
                }
            };
        }

        enhance(function videoFacade() {
            var facade = document.getElementById('dojoVideoFacade');
            if (!facade || !facade.dataset.embedSrc) return;
            var mobileScrollHandler = null;
            var mobileAutoplayTimer = null;
            function loadPlayer(muted) {
                if (!facade.isConnected) return null;
                if (mobileScrollHandler) window.removeEventListener('scroll', mobileScrollHandler);
                if (mobileAutoplayTimer) clearTimeout(mobileAutoplayTimer);
                var embed = new URL(facade.dataset.embedSrc);
                if (embed.protocol !== 'https:' || embed.hostname !== 'www.youtube.com') return null;
                embed.searchParams.set('mute', muted ? '1' : '0');
                var iframe = document.createElement('iframe');
                iframe.id = 'dojoVideo';
                iframe.src = embed.href;
                iframe.title = "Slayerkey's Training Dojo";
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                iframe.allowFullscreen = true;
                facade.replaceWith(iframe);
                if (muted) {
                    var button = document.createElement('button');
                    button.id = 'unmuteBtn';
                    button.className = 'dj-unmute';
                    button.type = 'button';
                    button.textContent = '🔊 Click for sound';
                    button.addEventListener('click', function () {
                        var origin = new URL(iframe.src).origin;
                        ['unMute', 'playVideo'].forEach(function (command) {
                            iframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: command, args: []}), origin);
                        });
                        button.remove();
                    });
                    iframe.parentNode.appendChild(button);
                }
                return iframe;
            }
            facade.addEventListener('click', function (event) {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (loadPlayer(false)) event.preventDefault();
            });
            if (!window.matchMedia('(max-width: 700px)').matches) {
                loadPlayer(true);
            } else {
                mobileScrollHandler = function () {
                    if (!facade.isConnected) return;
                    var rect = facade.getBoundingClientRect();
                    var visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
                    if (visible / rect.height >= .8 && !mobileAutoplayTimer) {
                        mobileAutoplayTimer = setTimeout(function () { loadPlayer(true); }, 250);
                    }
                };
                window.addEventListener('scroll', mobileScrollHandler, { passive: true });
            }
        });

        enhance(function inboundAttribution() {
            var inbound = new URLSearchParams(window.location.search);
            root.querySelectorAll('[data-sk-plan-direct="true"]').forEach(function (link) {
                var url = new URL(link.href);
                if (url.searchParams.get('utm_source') === 'private_preview') return;
                ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
                    if (inbound.get(key)) url.searchParams.set(key, inbound.get(key));
                });
                if (link.href !== url.href) link.href = url.href;
            });
        });

        enhance(function planChooser() {
            var template = document.getElementById('dojoPlanChooserTemplate');
            var monthly = root.querySelector('[data-sk-location="pricing_monthly"]');
            var annual = root.querySelector('[data-sk-location="pricing_annual"]');
            if (!template || !monthly || !annual) return;
            var modal = template.content.firstElementChild.cloneNode(true);
            var links = modal.querySelectorAll('.sk-plan-action');
            if (links.length !== 2) return;
            [monthly, annual].forEach(function (source, index) {
                var url = new URL(source.href);
                if (url.protocol !== 'https:' || url.hostname !== 'whop.com') throw new Error('Checkout unavailable');
                links[index].href = url.href;
            });
            document.body.appendChild(modal);
            var controller = modalController(modal, modal.querySelector('.sk-plan-close'));
            window.SK_openDojoPlanChooser = controller.open;
            // Capture analytics sees the original click. Only a successfully opened dialog
            // cancels the native anchor and the global WPCode smooth-scroll handler.
            document.querySelectorAll('.sk-cta-btn,.sk-mobile-cta,#sk-std [data-sk-checkout="true"]')
                .forEach(function (link) {
                    if (link.dataset.skPlanDirect === 'true') return;
                    link.addEventListener('click', function (event) {
                        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        var focusReturn = link;
                        if (link.closest('#sk-mobile')) {
                            document.getElementById('sk-close').click();
                            focusReturn = document.getElementById('sk-burger');
                        }
                        if (controller.open(focusReturn)) {
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    });
                });
        });

        enhance(function proofLightbox() {
            var modal = document.getElementById('djLightbox');
            if (!modal) return;
            var img = modal.querySelector('img');
            var close = modal.querySelector('.dj-lightbox-close');
            if (!img || !close) return;
            var controller = modalController(modal, close);
            root.querySelectorAll('[data-proof-src]').forEach(function (trigger) {
                trigger.addEventListener('click', function () {
                    if (!controller.open(trigger)) return;
                    img.src = trigger.dataset.proofSrc;
                    img.alt = trigger.querySelector('img').alt || 'Expanded proof';
                });
            });
        });

        enhance(function reviewAnimation() {
            var rail = root.querySelector('.dj-review-rail');
            var track = rail && rail.querySelector('.dj-review-track');
            if (!track || !window.IntersectionObserver) return;
            var inView = false;
            function update() { track.classList.toggle('is-running', inView && !document.hidden); }
            var observer = new IntersectionObserver(function (entries) {
                inView = entries[0].isIntersecting;
                update();
            });
            observer.observe(rail);
            document.addEventListener('visibilitychange', update);
            window.addEventListener('pagehide', function () { track.classList.remove('is-running'); });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
