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
    var root = document.getElementById('sk-coaching');
    if (!root) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = Array.prototype.slice.call(root.querySelectorAll('.coach-reveal'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var observer = new IntersectionObserver(function (entries, currentObserver) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.10, rootMargin: '0px 0px -6% 0px' });
      reveals.forEach(function (el) { observer.observe(el); });
    }

    var lightbox = document.getElementById('coachingLightbox');
    var image = lightbox && lightbox.querySelector('img');
    var close = lightbox && lightbox.querySelector('.coaching-lightbox-close');
    var proofButtons = Array.prototype.slice.call(root.querySelectorAll('[data-proof-src]'));
    var lastTrigger = null;

    function closeLightbox() {
      if (!lightbox || !image) return;
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      image.removeAttribute('src');
      document.body.style.overflow = '';
      if (lastTrigger) lastTrigger.focus();
    }

    proofButtons.forEach(function (button) {
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
