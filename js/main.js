(function (GF) {
  'use strict';

  var header = GF.createHeader(document.getElementById('header-root'));
  var hero = GF.createHero(document.getElementById('hero'), GF.heroSlides, { interval: 5000 });

  var svc = GF.gameService;
  var MOCK = svc.isMock();   // ?mock=... 일 때만 "예시 데이터" 배지를 표시
  var SAMPLE = '개발 단계의 예시 데이터입니다. ';
  var sections = [
    GF.createGameSection(document.getElementById('popular'), {
      id: 'popular',
      kicker: '01 · RANKING',
      title: '인기 게임 TOP 5',
      description: '지금 가장 주목받는 인기 게임과 국내 대표 온라인 게임을 만나보세요.',
      viewAllRouteId: 'rank',
      layout: 'rank',
      sampleNote: MOCK ? SAMPLE + '순위와 평점은 실제 인기 순위가 아닌 임시 값입니다.' : '',
      note: '데이터: Steam 공식 인기 차트(최대 동시접속자 수 기준, 하루 단위 집계). KR 표시 2개는 국내 대표 온라인 게임을 편집해 함께 보여드리는 것으로 순위에 포함되지 않습니다.',
      load: svc.getPopularGames
    }),
    GF.createGameSection(document.getElementById('latest'), {
      id: 'latest',
      kicker: '02 · NEW RELEASES',
      title: '최신 게임',
      description: '새롭게 출시된 게임들을 확인해보세요.',
      viewAllRouteId: 'new',
      layout: 'gallery',
      sampleNote: MOCK ? SAMPLE + '출시일은 Steam 스토어 기준이며, 실제 최신 출시 목록과 다를 수 있습니다.' : '',
      note: '데이터: CheapShark · Steam · FreeToGame. 출시일 기준 최신 PC 게임이며(Steam은 리뷰 50개 미만 제외), 최근 1년 내 출시된 국내 온라인 게임을 최대 3개 사이사이에 함께 표시합니다(‘국내’ 표시, 날짜는 각 카드 참고).',
      load: svc.getLatestGames
    }),
    GF.createGameSection(document.getElementById('sale'), {
      id: 'sale',
      kicker: '03 · DEALS',
      title: '할인 게임',
      description: '지금 할인 중인 게임을 확인해보세요.',
      viewAllRouteId: 'sale',
      layout: 'deals',
      sampleNote: MOCK ? SAMPLE + '스토어·가격·할인율은 실제 할인 정보가 아닌 임시 값입니다.' : '',
      note: '데이터: CheapShark (Steam · Epic Games Store). 가격은 USD 기준이며 조회 시점에 따라 달라질 수 있습니다.',
      load: svc.getSaleGames
    })
  ];
  var aiIntro = GF.createAiIntro(document.getElementById('ai'));
  var explore = GF.createExplore(document.getElementById('explore'));
  var footer = GF.createFooter(document.getElementById('footer-root'));
  var notice = GF.createRouteNotice();
  var toTop = GF.createToTop();
  var motion = GF.createMotion(document.getElementById('hero'));   // Hero 시차 · 카드 틸트 (마우스 전용)

  // ---------- 화면 전환: 메인 / 목록 페이지(#/sale, #/new …) / 게임 상세(#/game/<id>) ----------
  // 같은 페이지 안에서 <main id="main"> · <main id="page-…"> · <main id="detail"> 중 하나만 보여줍니다.
  // 목록 페이지는 page-configs.js 의 설정마다 <main id="page-<route>"> 를 만들어 상세 화면 뒤에 붙입니다.
  var viewEls = {
    main: document.getElementById('main'),
    detail: document.getElementById('detail')
  };
  var detail = GF.createGameDetail(viewEls.detail);
  var listPages = {};            // route → createListPage 인스턴스 (화면 이름도 route 와 같음: 'sale', 'new' …)
  var scrollOf = { main: 0 };    // 화면을 떠날 때의 스크롤 위치 — 상세에서 "돌아올 때"만 복원
  var anchor = viewEls.detail;
  Object.keys(GF.pageConfigs).forEach(function (route) {
    var el = document.createElement('main');
    el.id = 'page-' + route;
    el.className = 'gf-page';
    el.hidden = true;
    anchor.insertAdjacentElement('afterend', el);
    anchor = el;
    viewEls[route] = el;
    listPages[route] = GF.createListPage(el, GF.pageConfigs[route]);
    scrollOf[route] = 0;
  });
  var view = 'main';

  function viewFor() {
    if (GF.routes.currentGameId()) return 'detail';
    var routeId = GF.routes.currentRouteId();
    return listPages[routeId] ? routeId : 'main';
  }

  function onRoute() {
    var prev = view;
    var next = viewFor();
    if (prev !== next && scrollOf[prev] !== undefined) scrollOf[prev] = window.scrollY;
    if (prev === 'detail' && next !== 'detail') detail.hide();
    if (listPages[prev] && prev !== next) listPages[prev].hide();

    view = next;
    Object.keys(viewEls).forEach(function (k) { viewEls[k].hidden = k !== next; });

    if (next === 'detail') {
      window.scrollTo(0, 0);
      detail.show(GF.routes.currentGameId());
    } else if (listPages[next]) {
      if (prev !== next) window.scrollTo(0, prev === 'detail' ? scrollOf[next] : 0);   // 필터만 바꿀 때는 스크롤 유지
      listPages[next].show(GF.routes.currentQuery(), { focus: prev !== next });
    } else if (prev !== 'main') {
      window.scrollTo(0, prev === 'detail' ? scrollOf.main : 0);
    }
  }
  window.addEventListener('hashchange', onRoute);
  onRoute();   // 주소창에 #/game/..., #/sale 등을 직접 입력해 들어온 경우

  // 로고·Home 은 "처음으로": 상세에서 누르면 메인 맨 위로, 이미 메인이면 부드럽게 맨 위로 올라감.
  // (뒤로가기·"← 목록으로"는 보던 위치로 복원 — 위 scrollOf)
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function onHomeClick(e) {
    var a = e.target.closest && e.target.closest('.gf-logo, .gf-nav__link[data-route="home"], .gf-footer__logo, .gf-footer__nav a[href="#/"]');
    if (!a) return;
    if (view !== 'main') { scrollOf.main = 0; return; }   // 주소는 그대로 #/ 로 이동, 복원할 위치만 맨 위로
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', onHomeClick);

  // Hero 를 제외한 섹션 콘텐츠가 화면에 들어올 때 부드럽게 나타남
  var reveal = GF.reveal(document.querySelectorAll('main > section:not(.gf-hero) > .container'));

  window.addEventListener('pagehide', function () {
    hero.destroy();
    header.destroy();
    sections.forEach(function (s) { s.destroy(); });
    aiIntro.destroy();
    explore.destroy();
    footer.destroy();
    notice.destroy();
    toTop.destroy();
    motion.destroy();
    window.removeEventListener('hashchange', onRoute);
    document.removeEventListener('click', onHomeClick);
    detail.destroy();
    Object.keys(listPages).forEach(function (r) { listPages[r].destroy(); });
    reveal.destroy();
  });
})(window.GameFinder);
