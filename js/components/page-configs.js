/*
 * 목록 페이지 설정 — main.js 가 여기 있는 항목마다 <main id="page-<route>"> 를 만들고 createListPage 로 채웁니다.
 * 새 목록 페이지(인기 순위 등)를 추가하려면 여기에 설정 하나만 더하면 됩니다. (route 는 routes.js 의 id 와 같아야 함)
 */
(function (GF) {
  'use strict';

  var svc = GF.gameService;

  GF.pageConfigs = {
    sale: {
      route: 'sale',
      kicker: '03 · DEALS',
      title: '할인 게임',
      description: 'Steam·Epic Games에서 지금 할인 중인 게임을 한곳에서 비교해 보세요.',
      noun: '할인 게임',
      chips: {
        label: '스토어 선택', param: 'store', def: 'all',
        options: [{ id: 'all', label: '전체' }, { id: '1', label: 'Steam' }, { id: '25', label: 'Epic Games' }]
      },
      sort: {
        label: '정렬', param: 'sort', def: 'rating',
        options: [
          { id: 'rating', label: '추천순' },
          { id: 'savings', label: '할인율 높은 순' },
          { id: 'price-asc', label: '가격 낮은 순' },
          { id: 'price-desc', label: '가격 높은 순' }
        ]
      },
      card: 'row',
      empty: '조건에 맞는 할인 게임이 없습니다.',
      mockNote: '개발 단계의 예시 데이터입니다. 스토어·가격·할인율은 실제 할인 정보가 아닌 임시 값입니다.',
      note: '데이터: CheapShark (Steam · Epic Games Store). 가격은 USD 기준이며 조회 시점에 따라 달라질 수 있습니다. ' +
            '$1 미만의 게임과 Steam 긍정 평가 70% 미만의 게임은 제외합니다.',
      load: function (f, cursor) { return svc.getSaleList({ store: f.store, sort: f.sort, page: cursor }); }
    },

    rank: {
      route: 'rank',
      kicker: '01 · RANKING',
      title: '인기 순위',
      description: 'Steam에서 지금 가장 많은 사람이 플레이하는 게임 TOP 100을 확인해 보세요.',
      noun: '인기 게임',
      card: 'rankrow',
      firstCursor: 0,   // game-service 의 getRankList offset
      empty: '표시할 인기 게임이 없습니다.',
      mockNote: '개발 단계의 예시 데이터입니다. 순위와 평점은 실제 인기 순위가 아닌 임시 값입니다.',
      note: '데이터: Steam 공식 인기 차트(하루 단위 집계를 미리 받아 둔 것이라 실시간이 아니며 기준일 시점의 순위입니다). ' +
            '숫자는 그날 게임을 플레이한 최대 동시접속자 수이고, 순위는 Steam의 공식 집계라 숫자 크기와 항상 일치하지는 않습니다. ' +
            '순위 변동은 지난주 순위와 비교한 값이며, 게임이 아닌 항목(모드 등)은 제외해 순위 번호가 건너뛸 수 있습니다. ' +
            '플랫폼·장르 필터는 데이터가 없어 아직 제공하지 않습니다.',
      load: function (f, cursor) { return svc.getRankList(cursor); }
    },

    'new': {
      route: 'new',
      kicker: '02 · NEW RELEASES',
      title: '신작',
      description: '새롭게 출시된 PC 게임을 출시일이 가까운 순서로 확인해 보세요.',
      noun: '신작 게임',
      card: 'release',
      firstCursor: { p: 0 },   // game-service 의 getReleaseList cursor
      empty: '조건에 맞는 신작이 없습니다.',
      mockNote: '개발 단계의 예시 데이터입니다. 출시일은 Steam 스토어 기준이며, 실제 최신 출시 목록과 다를 수 있습니다.',
      note: '데이터: CheapShark · Steam. 출시일 기준 최신 PC 게임이며 Steam 리뷰 50개 미만의 게임은 제외합니다. ' +
            '플랫폼·장르 필터는 데이터가 부족해(PC 게임만 제공, 장르는 일부 게임에만 있음) 아직 제공하지 않습니다.',
      load: function (f, cursor) { return svc.getReleaseList(cursor); }
    }
  };
})(window.GameFinder = window.GameFinder || {});
