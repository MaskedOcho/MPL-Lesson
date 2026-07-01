/* MPL Pursuits — Global Interactions */

/* ── MAILERLITE UNIVERSAL SCRIPT ── */
(function(w,d,e,u,f,l,n){w[f]=w[f]||function(){(w[f].q=w[f].q||[]).push(arguments);},
l=d.createElement(e),l.async=1,l.src=u,n=d.getElementsByTagName(e)[0],
n.parentNode.insertBefore(l,n);})(window,document,'script',
'https://assets.mailerlite.com/js/universal.js','ml');
ml('account', '2481688');

(function () {
  'use strict';

  /* ── NAV GLASS EFFECT ON SCROLL ── */
  var nav = document.querySelector('nav');
  if (nav) {
    function checkNav() {
      nav.classList.toggle('nav-scrolled', window.scrollY > 8);
    }
    window.addEventListener('scroll', checkNav, { passive: true });
    checkNav();
  }

  /* ── SCROLL REVEAL ── */
  if (!('IntersectionObserver' in window)) return;

  var selectors = [
    '.svc-card',
    '.bundle-card',
    '.subpage-card',
    '.pricing-card',
    '.mpc-card',
    '.tier-step',
    '.step',
    '.inc-item',
    '.ncaa-box',
    '.stats-bar-inner > div',
    '.resource-section',
    '.resource-category',
    'section .inner',
    '.resource-library-head'
  ].join(', ');

  var els = Array.from(document.querySelectorAll(selectors));
  if (!els.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });

  /* First pass — mark off-screen elements */
  els.forEach(function (el) {
    var rect = el.getBoundingClientRect();
    if (rect.top >= window.innerHeight * 0.92) {
      el.classList.add('scroll-reveal');
      observer.observe(el);
    }
  });

  /* Second pass — stagger siblings within grid containers */
  document.querySelectorAll('.scroll-reveal').forEach(function (el) {
    var parent = el.parentElement;
    if (!parent) return;
    try {
      var siblings = Array.from(parent.querySelectorAll(':scope > .scroll-reveal'));
      var idx = siblings.indexOf(el);
      if (idx > 0 && idx < 7) {
        el.style.transitionDelay = (idx * 0.075) + 's';
      }
    } catch (e) { /* :scope not supported, skip stagger */ }
  });

})();
