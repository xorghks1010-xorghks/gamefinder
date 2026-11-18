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

  /** 현재 hash 의 쿼리를 객체로: '#/sale?store=1&sort=savings' → { store: '1', sort: 'savings' } */
  function currentQuery() {
    var i = window.location.hash.indexOf('?');
    var out = {};
    if (i === -1) return out;
    window.location.hash.slice(i + 1).split('&').forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split('=');
      try { out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); } catch (e) { /* 잘못된 인코딩은 무시 */ }
    });
    return out;
  }

  /** 현재 hash 가 게임 상세면 게임 id, 아니면 null: '#/game/730' → '730' */
  function currentGameId() {
    var m = /^#\/game\/([^?]+)/.exec(window.location.hash);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  /** 현재 location.hash에서 라우트 id를 읽음 (알 수 없으면 home) */
  function currentRouteId() {
    var hash = window.location.hash.split('?')[0] || '#/';
    if (hash.indexOf('#/game/') === 0) return 'game';   // 상세 페이지는 메뉴 항목이 아님(현재 메뉴 표시 없음)
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
    currentRouteId: currentRouteId,
    currentQuery: currentQuery,
    currentGameId: currentGameId
  };
})(window.GameFinder = window.GameFinder || {});
