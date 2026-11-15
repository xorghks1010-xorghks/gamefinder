/*
 * 섹션 진입 페이드 — 화면에 들어올 때 한 번만 부드럽게 나타납니다.
 *   const r = GameFinder.reveal(elements);  r.destroy();
 * JS 가 동작하지 않거나 IntersectionObserver 가 없으면 아무 효과 없이 그대로 보입니다.
 * prefers-reduced-motion 일 때는 CSS(.gf-reveal)에서 애니메이션이 제거됩니다.
 */
(function (GF) {
  'use strict';

  function reveal(elements) {
    var list = Array.prototype.slice.call(elements);
    if (!('IntersectionObserver' in window)) return { destroy: function () {} };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    list.forEach(function (el) {
      el.classList.add('gf-reveal');
      io.observe(el);
    });

    return {
      destroy: function () {
        io.disconnect();
        list.forEach(function (el) { el.classList.remove('gf-reveal', 'is-visible'); });
      }
    };
  }

  GF.reveal = reveal;
})(window.GameFinder = window.GameFinder || {});
