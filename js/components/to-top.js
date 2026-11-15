/*
 * 맨 위로 버튼 — 일정 이상 스크롤하면 우측 하단에 나타납니다.
 *   const toTop = GameFinder.createToTop();  toTop.destroy();
 */
(function (GF) {
  'use strict';

  var SHOW_AFTER = 600;   // px

  function createToTop() {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gf-totop';
    btn.setAttribute('aria-label', '맨 위로 이동');
    btn.hidden = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>';
    document.body.appendChild(btn);

    var visible = false;

    function onScroll() {
      var show = window.scrollY > SHOW_AFTER;
      if (show === visible) return;
      visible = show;
      if (show) {
        btn.hidden = false;
        void btn.offsetWidth;   // hidden 해제 직후 transition 이 걸리도록
        btn.classList.add('is-visible');
      } else {
        btn.classList.remove('is-visible');
      }
    }

    // 사라지는 transition 이 끝난 뒤에 hidden 처리해 키보드 포커스 대상에서 제외
    function onTransitionEnd() { if (!visible) btn.hidden = true; }

    function onClick() {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('transitionend', onTransitionEnd);
    btn.addEventListener('click', onClick);
    onScroll();

    return {
      destroy: function () {
        window.removeEventListener('scroll', onScroll);
        btn.removeEventListener('transitionend', onTransitionEnd);
        btn.removeEventListener('click', onClick);
        btn.remove();
      }
    };
  }

  GF.createToTop = createToTop;
})(window.GameFinder = window.GameFinder || {});
