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

    find: {
      route: 'find',
      kicker: 'FIND',
      title: '게임 찾기',
      description: '장르와 플레이 방식을 골라 내 취향에 맞는 게임을 찾아보세요.',
      noun: '게임',
      query: { param: 'q', label: '게임명으로 좁히기', placeholder: '게임명으로 좁히기 (영어)', max: 100 },
      groups: [
        { label: '장르 선택 (여러 개 선택 가능)', title: '장르', param: 'genre', multi: true, options: [
          { id: 'action', label: '액션' }, { id: 'adventure', label: '어드벤처' }, { id: 'rpg', label: 'RPG' },
          { id: 'strategy', label: '전략' }, { id: 'simulation', label: '시뮬레이션' }, { id: 'sports', label: '스포츠' },
          { id: 'racing', label: '레이싱' }, { id: 'indie', label: '인디' }, { id: 'casual', label: '캐주얼' }, { id: 'mmo', label: 'MMO' }
        ] },
        { label: '플레이 방식 선택 (여러 개 선택 가능)', title: '플레이 방식', param: 'mode', multi: true, options: [
          { id: 'single', label: '싱글플레이' }, { id: 'multi', label: '멀티플레이' }, { id: 'coop', label: '협동' }, { id: 'pvp', label: 'PvP' }
        ] },
        { label: '가격 선택', title: '가격', param: 'price', def: 'all', options: [
          { id: 'all', label: '전체' }, { id: 'free', label: '무료' }, { id: 'paid', label: '유료' }
        ] }
      ],
      sort: { label: '정렬', param: 'sort', def: 'popular', options: [
        { id: 'popular', label: '인기순 (리뷰 많은 순)' }, { id: 'score', label: '평점순 (Metacritic)' },
        { id: 'new', label: '최신순' }, { id: 'name', label: '이름순' }
      ] },
      // 메인의 플랫폼·장르 타일(#/find?platform=ps5, ?genre=horror)이 가리키는 것 중 데이터가 없는 것은 이유를 알려줌
      unsupported: function (p) {
        var known = { action: 1, adventure: 1, rpg: 1, strategy: 1, simulation: 1, sports: 1, racing: 1, indie: 1, casual: 1, mmo: 1 };
        if (p.platform && p.platform !== 'pc') {
          var plat = svc.getPlatforms().filter(function (x) { return x.id === p.platform; })[0];
          return '현재는 PC(Steam) 게임 데이터만 제공해서 ' + (plat ? plat.name : p.platform) + ' 게임은 찾을 수 없어요.';
        }
        var bad = String(p.genre || '').split(',').filter(function (g) { return g && !known[g]; });
        if (bad.length) {
          var names = bad.map(function (id) {
            var g = svc.getGenres().filter(function (x) { return x.id === id; })[0];
            return g ? g.name : id;
          });
          return '‘' + names.join(', ') + '’ 장르는 아직 제공하지 않아요. 아래 장르 중에서 골라 보세요.';
        }
        return '';
      },
      card: 'result',
      empty: '조건에 맞는 게임이 없습니다. 필터를 줄여 보세요.',
      mockNote: '개발 단계의 예시 데이터입니다.',
      note: '데이터: Steam · CheapShark. 인기 PC 게임 약 600개(Steam 인기 차트와 Metacritic 상위 게임)를 미리 받아 둔 목록에서 찾으므로 전체 게임이 아니며, 기준일 시점의 정보입니다. ' +
            '같은 그룹에서 여러 개를 고르면 하나라도 해당되는 게임을, 다른 그룹과는 모두 만족하는 게임을 보여줍니다. ' +
            '콘솔 플랫폼, 공포·FPS·퍼즐 같은 세부 장르는 데이터가 없어 아직 제공하지 않습니다.',
      load: function (f, cursor) { return svc.getFindList(f, cursor); }
    },

    search: {
      route: 'search',
      kicker: 'SEARCH',
      title: '검색 결과',
      description: '게임 이름으로 찾아보세요.',
      noun: '검색 결과',
      query: { param: 'q', label: '게임명 검색', required: true, placeholder: '게임명을 입력하세요 (예: elden, 로스트아크)', prompt: '검색어를 입력해 주세요. 게임 이름은 영어 또는 일부 국내 게임의 한글 이름으로 찾을 수 있습니다.', max: 100 },
      descFor: function (f) { return f.q ? '‘' + f.q + '’ 검색 결과입니다.' : '게임 이름으로 찾아보세요.'; },
      docTitleFor: function (f) { return f.q ? '‘' + f.q + '’ 검색' : '검색'; },
      card: 'result',
      empty: function (f) { return '‘' + f.q + '’에 대한 검색 결과가 없습니다. 철자를 확인하거나 영어 이름으로 다시 검색해 보세요.'; },
      mockNote: '개발 단계의 예시 데이터에서 찾은 결과입니다.',
      note: '데이터: CheapShark · Steam · FreeToGame. Steam·Epic Games에서 가격이 확인되는 게임, Steam 인기 차트의 게임, 무료 온라인 게임을 함께 찾습니다. ' +
            '게임 이름은 영어로 검색하며, 일부 국내 인기 게임(배틀그라운드·로스트아크·검은사막·메이플스토리·던전앤파이터)은 한글로도 찾을 수 있습니다. ' +
            '결과는 이름이 검색어와 가까운 순서이며, 가격은 USD 기준입니다.',
      load: function (f, cursor) { return svc.getSearchList(f.q, cursor); }
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
