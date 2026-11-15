/*
 * 라우트 정의 — 메뉴·Hero CTA가 모두 여기서 경로를 가져갑니다.
 * 현재는 해시 라우팅(#/경로)이며, 실제 페이지가 생기면 path만 바꾸면 됩니다.
 * (예: '#/ai' → 'ai.html')
 */
(function (GF) {
  'use strict';

  var ROUTES = {
    home:   { id: 'home',   label: 'Home',     path: '#/' },
    find:   { id: 'find',   label: '게임 찾기', path: '#/find' },
    rank:   { id: 'rank',   label: '인기 순위', path: '#/rank' },
    new:    { id: 'new',    label: '신작',      path: '#/new' },
    sale:   { id: 'sale',   label: '할인 게임', path: '#/sale' },
    ai:     { id: 'ai',     label: 'AI 추천',   path: '#/ai' },
    search: { id: 'search', label: '검색 결과', path: '#/search' }
  };

  var NAV_ORDER = ['home', 'find', 'rank', 'new', 'sale', 'ai'];

  function hrefOf(id) {
    return ROUTES[id] ? ROUTES[id].path : ROUTES.home.path;
  }

  function searchHref(query) {
    return ROUTES.search.path + '?q=' + encodeURIComponent(query);
  }

  /** 게임 상세(미구현) 경로 — 카드 링크용 */
  function gameHref(gameId) {
    return '#/game/' + encodeURIComponent(gameId);
  }

  /** 게임 찾기(미구현)에 필터를 전달하는 경로: findHref({ platform: 'pc' }) → '#/find?platform=pc' */
  function findHref(params) {
    var qs = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return ROUTES.find.path + (qs ? '?' + qs : '');
  }

  /** 현재 location.hash에서 라우트 id를 읽음 (알 수 없으면 home) */
  function currentRouteId() {
    var hash = window.location.hash.split('?')[0] || '#/';
    if (hash === '#' || hash === '') hash = '#/';
    for (var id in ROUTES) {
      if (ROUTES[id].path === hash) return id;
    }
    return 'home';
  }

  GF.routes = {
    ROUTES: ROUTES,
    NAV_ORDER: NAV_ORDER,
    hrefOf: hrefOf,
    searchHref: searchHref,
    gameHref: gameHref,
    findHref: findHref,
    currentRouteId: currentRouteId
  };
})(window.GameFinder = window.GameFinder || {});
