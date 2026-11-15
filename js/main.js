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
      title: '글로벌 인기 게임 TOP 5',
      description: '지금 가장 주목받는 인기 게임과 국내 대표 온라인 게임을 만나보세요.',
      viewAllRouteId: 'rank',
      layout: 'rank',
      sampleNote: MOCK ? SAMPLE + '순위와 평점은 실제 인기 순위가 아닌 임시 값입니다.' : '',
      note: '데이터: CheapShark · Steam. Metacritic 75점 이상, Steam 긍정 평가 80% 이상인 게임을 Steam 리뷰 수 순으로 표시합니다(실시간 플레이어 수 순위가 아닙니다). KR 표시 2개는 국내 대표 온라인 게임을 편집해 함께 보여드리는 것으로 순위에 포함되지 않습니다.',
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
    reveal.destroy();
  });
})(window.GameFinder);
