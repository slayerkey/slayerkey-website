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

        /* Fill the small theme-shell gap below the header without moving hero content. */
        root.style.marginTop = '-31px';
        root.style.paddingTop = '31px';

        /* Guarantee the Framer-style reveal even if the global site reveal script changes. */
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

        /* Use the real site's header CTA, with preview-specific attribution. */
        Array.prototype.slice.call(document.querySelectorAll('.sk-cta-btn,.sk-mobile-cta')).forEach(function (link) {
            link.href = 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?utm_source=private_preview&utm_medium=dojo_page&utm_campaign=dojo_membership&utm_content=global_header_start_improving';
            link.target = '_blank';
            link.rel = 'noopener';
            if (link.textContent && link.textContent.trim()) link.textContent = 'Start Improving';
        });

        /* The newer community-wins binary was corrupt. Use the known-good original Dojo collage. */
        var winsAsset = '/wp-content/plugins/slayerkey-website/previews/dojo-v3/assets/wins.webp?v=20260822-final';
        Array.prototype.slice.call(root.querySelectorAll('.dj-win-thumb')).forEach(function (thumb) {
            thumb.style.backgroundImage = 'url("' + winsAsset + '")';
        });
        Array.prototype.slice.call(root.querySelectorAll('.dj-win-card[data-proof-src]')).forEach(function (card) {
            card.setAttribute('data-proof-src', winsAsset);
        });

        /* Keep pricing deliberately simple: Monthly, Annual, and the annual bonus. */
        var planCards = root.querySelectorAll('#pricing .dj-price-card');
        if (planCards.length >= 2) {
            var monthly = planCards[0];
            var annual = planCards[1];
            var monthlyPrice = monthly.querySelector('.dj-price');
            var monthlyLabel = monthly.querySelector('.dj-per');
            var monthlyNote = monthly.querySelector('.dj-plan-note');
            var annualPrice = annual.querySelector('.dj-price');
            var annualLabel = annual.querySelector('.dj-per');
            var annualSave = annual.querySelector('.dj-plan-save');
            var annualNote = annual.querySelector('.dj-plan-note');

            if (monthlyLabel && monthlyPrice) {
                monthlyLabel.textContent = 'Monthly';
                monthly.insertBefore(monthlyLabel, monthlyPrice);
            }
            if (monthlyNote) monthlyNote.remove();

            if (annualLabel && annualPrice) {
                annualLabel.textContent = 'Annual';
                annual.insertBefore(annualLabel, annualPrice);
            }
            if (annualSave && annualPrice) {
                annualSave.textContent = 'Two months free';
                annual.insertBefore(annualSave, annualPrice);
            }
            if (annualNote) annualNote.remove();
        }

        /* Move review cards left-to-right with JS so theme/global CSS cannot cancel the motion. */
        var reviewTrack = root.querySelector('.dj-review-track');
        if (reviewTrack && window.requestAnimationFrame) {
            reviewTrack.style.setProperty('animation', 'none', 'important');
            reviewTrack.style.setProperty('animation-play-state', 'paused', 'important');

            var reviewOffset = 0;
            var reviewHalf = 0;
            var reviewLast = 0;
            var reviewSpeed = 52;

            function measureReviewRail() {
                reviewHalf = reviewTrack.scrollWidth / 2;
                reviewOffset = -reviewHalf;
                reviewTrack.style.transform = 'translate3d(' + reviewOffset + 'px,0,0)';
            }

            function moveReviewRail(now) {
                if (!reviewLast) reviewLast = now;
                var delta = Math.min((now - reviewLast) / 1000, 0.05);
                reviewLast = now;
                reviewOffset += reviewSpeed * delta;

                if (reviewOffset >= 0) {
                    reviewOffset = -reviewHalf;
                }

                reviewTrack.style.transform = 'translate3d(' + reviewOffset + 'px,0,0)';
                window.requestAnimationFrame(moveReviewRail);
            }

            window.requestAnimationFrame(function () {
                measureReviewRail();
                window.requestAnimationFrame(moveReviewRail);
            });

            window.addEventListener('resize', function () {
                reviewLast = 0;
                measureReviewRail();
            }, { passive: true });
        }

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
                    lightboxImage.alt = childImage ? childImage.alt : 'Expanded community proof';
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
    });
})();