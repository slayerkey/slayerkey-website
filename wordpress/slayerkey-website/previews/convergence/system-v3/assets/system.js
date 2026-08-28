/* Slayerkey Improvement System (System v4 rebuild).
   Static page behavior only: VSL autoplay + unmute, scroll reveals, and the
   proof lightbox. All copy lives in the HTML. CTA analytics are handled by
   the sitewide tracking.js via data-sk-cta attributes. */
(function () {
  'use strict';

  /* Swap this one constant to change the hero VSL.
     Current: the System overview video used on the live /system page. */
  var SYSTEM_VSL_ID = 'DspVHi5gi88';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    var root = document.getElementById('sk-system');
    if (!root) return;

    /* Hero VSL: autoplay muted, then make sound opt-in unmistakable. */
    var vsl = document.getElementById('systemVideo');
    var unmuteButton = document.getElementById('systemUnmute');
    if (vsl && unmuteButton) {
      vsl.src = 'https://www.youtube.com/embed/' + SYSTEM_VSL_ID + '?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1';

      function post(command) {
        try {
          vsl.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), '*');
        } catch (e) {}
      }

      unmuteButton.hidden = false;
      unmuteButton.addEventListener('click', function () {
        post('unMute');
        post('playVideo');
        unmuteButton.hidden = true;
        window.setTimeout(function () {
          if (vsl.src.indexOf('mute=1') !== -1) {
            vsl.src = vsl.src.replace('mute=1', 'mute=0');
          }
        }, 300);
      });
    }

    /* Scroll reveal, matching the live homepage motion. */
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = Array.prototype.slice.call(root.querySelectorAll('.reveal'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('show'); });
    } else {
      var observer = new IntersectionObserver(function (entries, currentObserver) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('show');
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.10, rootMargin: '0px 0px -6% 0px' });
      reveals.forEach(function (el) { observer.observe(el); });
    }

    /* Proof image lightbox. */
    var lightbox = document.getElementById('systemLightbox');
    var image = lightbox && lightbox.querySelector('img');
    var close = lightbox && lightbox.querySelector('.sy-lightbox-close');
    var lastTrigger = null;

    function closeLightbox() {
      if (!lightbox || !image) return;
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      image.removeAttribute('src');
      document.body.style.overflow = '';
      if (lastTrigger) lastTrigger.focus();
    }

    Array.prototype.slice.call(root.querySelectorAll('[data-proof-src]')).forEach(function (button) {
      button.addEventListener('click', function () {
        if (!lightbox || !image) return;
        lastTrigger = button;
        image.src = button.getAttribute('data-proof-src') || '';
        var thumb = button.querySelector('img');
        image.alt = thumb && thumb.alt ? thumb.alt : 'Expanded proof';
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (close) close.focus();
      });
    });

    if (close) close.addEventListener('click', closeLightbox);
    if (lightbox) {
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox) closeLightbox();
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && lightbox && lightbox.classList.contains('open')) closeLightbox();
    });
  });
})();
