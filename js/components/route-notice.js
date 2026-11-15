/*
 * 미구현 페이지 안내 — 아직 없는 경로(#/find, #/game/… 등)로 이동할 때
 * 빈 화면이나 오류 대신 메인 화면을 유지하면서 짧은 안내를 보여줍니다.
 * 페이지가 구현되면 해당 라우트를 IMPLEMENTED 에 추가하세요.
 */
(function (GF) {
  'use strict';

  var IMPLEMENTED = ['#/', '#'];
  var HIDE_MS = 3000;

  function createRouteNotice() {
    var el = document.createElement('div');
    el.className = 'gf-notice';
    el.setAttribute('role', 'status');
    el.textContent = '준비 중인 페이지입니다. 현재는 메인 화면과 게임 상세만 제공됩니다.';
    document.body.appendChild(el);

    var timer = null;

    function show() {
      el.classList.add('is-visible');
      clearTimeout(timer);
      timer = setTimeout(function () { el.classList.remove('is-visible'); }, HIDE_MS);
    }

    function onClick(e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('skip-link')) return;
      var href = a.getAttribute('href');
      if (IMPLEMENTED.indexOf(href) === -1 && href.indexOf('#/game/') !== 0) show();   // 게임 상세는 구현됨
    }

    function onSearch() { show(); }

    document.addEventListener('click', onClick);
    document.addEventListener('gamefinder:search', onSearch);

    return {
      destroy: function () {
        clearTimeout(timer);
        document.removeEventListener('click', onClick);
        document.removeEventListener('gamefinder:search', onSearch);
        el.remove();
      }
    };
  }

  GF.createRouteNotice = createRouteNotice;
})(window.GameFinder = window.GameFinder || {});
