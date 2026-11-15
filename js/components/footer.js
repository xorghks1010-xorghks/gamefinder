/*
 * Footer — Header와 같은 메뉴 정의(routes.NAV_ORDER)를 재사용합니다.
 */
(function (GF) {
  'use strict';

  function createFooter(root) {
    var routes = GF.routes;
    var links = routes.NAV_ORDER.map(function (id) {
      var r = routes.ROUTES[id];
      return '<li><a href="' + r.path + '">' + r.label + '</a></li>';
    }).join('');

    root.innerHTML =
      '<footer class="gf-footer">' +
        '<div class="container">' +
          '<div class="gf-footer__top">' +
            '<div class="gf-footer__brand">' +
              '<a class="gf-footer__logo" href="' + routes.hrefOf('home') + '" aria-label="GameFinder 홈으로 이동">Game<b>Finder</b></a>' +
              '<p class="gf-footer__intro">인기 게임부터 내 취향에 맞는 게임까지 한곳에서 찾는 게임 탐색 웹사이트</p>' +
            '</div>' +
            '<nav class="gf-footer__nav" aria-label="푸터 메뉴"><ul>' + links + '</ul></nav>' +
          '</div>' +
          '<div class="gf-footer__bottom">' +
            '<p class="gf-footer__copy">© ' + new Date().getFullYear() + ' GameFinder</p>' +
            '<p class="gf-footer__credit">게임 데이터: CheapShark · 이미지: Steam (저작권은 각 게임 권리자에게 있습니다)</p>' +
          '</div>' +
        '</div>' +
      '</footer>';

    return { destroy: function () { root.innerHTML = ''; } };
  }

  GF.createFooter = createFooter;
})(window.GameFinder = window.GameFinder || {});
