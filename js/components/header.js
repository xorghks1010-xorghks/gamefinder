/*
 * Header 컴포넌트
 *   const header = GameFinder.createHeader(rootEl);
 *   header.destroy();   // 이벤트 리스너 정리
 * 검색 실행 시 document 에 'gamefinder:search' 이벤트({detail:{query}})를 발생시키고
 * 검색 결과 라우트(#/search?q=)로 이동합니다. 결과 페이지는 다음 단계에서 연결합니다.
 */
(function (GF) {
  'use strict';

  var ICONS = {
    logo: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9h14a6 6 0 0 1 5.8 4.6l1.1 5A4.4 4.4 0 0 1 25.7 24c-1.4 0-2.7-.7-3.5-1.9L21 20.5H11l-1.2 1.6A4.2 4.2 0 0 1 6.3 24 4.4 4.4 0 0 1 2.1 18.600l1.100-5A6 6 0 0 1 9 9Z"/><path d="M10 12.500v4M8 14.500h4"/><circle cx="21" cy="13.500" r=".8" fill="currentColor"/><circle cx="24" cy="16" r=".8" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/></svg>',
    menu: '<svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  var MOBILE_QUERY = '(max-width: 960px)';

  function createHeader(root) {
    var routes = GF.routes;

    var navItems = routes.NAV_ORDER.map(function (id) {
      var r = routes.ROUTES[id];
      return '<li><a class="gf-nav__link" href="' + r.path + '" data-route="' + r.id + '">' + r.label + '</a></li>';
    }).join('');

    root.innerHTML =
      '<header class="gf-header">' +
        '<div class="container gf-header__inner">' +
          '<a class="gf-logo" href="' + routes.hrefOf('home') + '" aria-label="GameFinder 홈으로 이동">' +
            '<span class="gf-logo__mark">' + ICONS.logo + '</span><span>Game<b>Finder</b></span>' +
          '</a>' +
          '<button type="button" class="gf-toggle" aria-expanded="false" aria-controls="gf-panel" aria-label="메뉴 열기">' +
            ICONS.menu + ICONS.close +
          '</button>' +
          '<div class="gf-panel" id="gf-panel">' +
            '<nav class="gf-nav" aria-label="주요 메뉴"><ul class="gf-nav__list">' + navItems + '</ul></nav>' +
            '<form class="gf-search" role="search" action="#">' +
              '<label class="sr-only" for="gf-search-input">게임명 검색</label>' +
              '<input class="gf-search__input" id="gf-search-input" type="search" name="q" placeholder="게임명을 검색하세요" autocomplete="off" maxlength="100">' +
              '<button class="gf-search__btn" type="submit" aria-label="검색">' + ICONS.search + '</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</header>';

    var header = root.querySelector('.gf-header');
    var toggle = root.querySelector('.gf-toggle');
    var form = root.querySelector('.gf-search');
    var input = root.querySelector('.gf-search__input');
    var links = root.querySelectorAll('.gf-nav__link');
    var mq = window.matchMedia(MOBILE_QUERY);

    function setOpen(open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    }

    function setActive(routeId) {
      links.forEach(function (a) {
        if (a.dataset.route === routeId) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    }

    function onToggle() { setOpen(!header.classList.contains('is-open')); }

    function onSubmit(e) {
      e.preventDefault();
      var query = input.value.trim();
      if (!query) { input.focus(); return; }
      document.dispatchEvent(new CustomEvent('gamefinder:search', { detail: { query: query } }));
      window.location.hash = routes.searchHref(query);
      setOpen(false);
    }

    function onNavClick() { setOpen(false); }

    function onKeydown(e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    }

    function onRoute() { setActive(routes.currentRouteId()); }

    function onBreakpoint() { if (!mq.matches) setOpen(false); }

    // 스크롤하면 투명 → 블러 처리된 다크 바로 전환
    function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 24); }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toggle.addEventListener('click', onToggle);
    form.addEventListener('submit', onSubmit);
    header.addEventListener('keydown', onKeydown);
    links.forEach(function (a) { a.addEventListener('click', onNavClick); });
    window.addEventListener('hashchange', onRoute);
    mq.addEventListener('change', onBreakpoint);
    onRoute();

    return {
      setActive: setActive,
      destroy: function () {
        window.removeEventListener('scroll', onScroll);
        toggle.removeEventListener('click', onToggle);
        form.removeEventListener('submit', onSubmit);
        header.removeEventListener('keydown', onKeydown);
        links.forEach(function (a) { a.removeEventListener('click', onNavClick); });
        window.removeEventListener('hashchange', onRoute);
        mq.removeEventListener('change', onBreakpoint);
        root.innerHTML = '';
      }
    };
  }

  GF.createHeader = createHeader;
})(window.GameFinder = window.GameFinder || {});
