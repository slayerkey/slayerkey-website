/* Slayerkey Private Mentorship (Coaching v3 rebuild).
   Static page behavior only: VSL autoplay + unmute, click-to-play testimonial
   videos, scroll reveals, and the proof lightbox. All copy lives in the HTML. */
(function () {
  'use strict';

  /* Swap this one constant to change the hero VSL.
     Current: "I Coached EVERY Rank in VALORANT" compilation.
     Alternate considered: Woohoojin breakdown, JT9v3kR-UQY. */
  var COACHING_VSL_ID = 'E4AXcp7l4YE';

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

    /* Hero VSL: autoplay muted, then make sound opt-in unmistakable. */
    var vsl = document.getElementById('coachingVideo');
    var unmuteButton = document.getElementById('coachingUnmute');
    if (vsl && unmuteButton) {
      vsl.src = 'https://www.youtube.com/embed/' + COACHING_VSL_ID + '?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1';

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

    /* Student video testimonials: open in a lightbox so short form video gets
       a proper portrait frame instead of playing inside a small card. */
    var videoBox = document.getElementById('coachingVideoLightbox');
    var videoFrame = videoBox && videoBox.querySelector('.ch-video-frame');
    var videoClose = videoBox && videoBox.querySelector('.ch-video-close');
    var lastVideoTrigger = null;

    function closeVideo() {
      if (!videoBox || !videoFrame) return;
      videoBox.classList.remove('open');
      videoBox.setAttribute('aria-hidden', 'true');
      var existing = videoFrame.querySelector('iframe');
      if (existing) existing.remove();
      document.body.style.overflow = '';
      if (lastVideoTrigger) lastVideoTrigger.focus();
    }

    Array.prototype.slice.call(root.querySelectorAll('[data-yt]')).forEach(function (poster) {
      poster.addEventListener('click', function () {
        var videoId = poster.getAttribute('data-yt');
        if (!videoId || !videoBox || !videoFrame) return;
        lastVideoTrigger = poster;
        var existing = videoFrame.querySelector('iframe');
        if (existing) existing.remove();
        videoFrame.classList.toggle('is-wide', poster.getAttribute('data-yt-wide') === 'true');
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
        iframe.title = poster.getAttribute('aria-label') || 'Student video testimonial';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        videoFrame.appendChild(iframe);
        videoBox.classList.add('open');
        videoBox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (videoClose) videoClose.focus();
      });
    });

    if (videoClose) videoClose.addEventListener('click', closeVideo);
    if (videoBox) {
      videoBox.addEventListener('click', function (event) {
        if (event.target === videoBox) closeVideo();
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && videoBox && videoBox.classList.contains('open')) closeVideo();
    });

    /* Scroll reveal, matching the live homepage motion. */
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = Array.prototype.slice.call(root.querySelectorAll('.reveal, .ch-ranks'));

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
    var lightbox = document.getElementById('coachingLightbox');
    var image = lightbox && lightbox.querySelector('img');
    var close = lightbox && lightbox.querySelector('.ch-lightbox-close');
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
