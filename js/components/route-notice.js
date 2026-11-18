/*
 * 미구현 페이지 안내 — 아직 없는 경로(#/find, #/game/… 등)로 이동할 때
 * 빈 화면이나 오류 대신 메인 화면을 유지하면서 짧은 안내를 보여줍니다.
 * 페이지가 구현되면 해당 라우트를 IMPLEMENTED 에 추가하세요.
 */
(function (GF) {
  'use strict';

  var IMPLEMENTED = ['#/', '#'];   // 여기에 더해 page-configs.js 에 있는 목록 페이지(#/sale, #/new …)도 구현된 것으로 취급
  var HIDE_MS = 3000;

  function createRouteNotice() {
    var el = document.createElement('div');
    el.className = 'gf-notice';
    el.setAttribute('role', 'status');
    el.textContent = '준비 중인 페이지입니다. AI 추천은 아직 준비 중이며, 그 외 메뉴는 모두 이용할 수 있습니다.';
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
      var path = href.split('?')[0];   // '#/sale?store=1' 처럼 쿼리가 붙어도 같은 페이지
      var isList = !!(GF.pageConfigs && GF.pageConfigs[path.replace('#/', '')]);
      if (IMPLEMENTED.indexOf(path) === -1 && !isList && href.indexOf('#/game/') !== 0) show();   // 게임 상세는 구현됨
    }

    document.addEventListener('click', onClick);

    return {
      destroy: function () {
        clearTimeout(timer);
        document.removeEventListener('click', onClick);
        el.remove();
      }
    };
  }

  GF.createRouteNotice = createRouteNotice;
})(window.GameFinder = window.GameFinder || {});
