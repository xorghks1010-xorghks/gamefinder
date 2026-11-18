/*
 * 게임 데이터 서비스 — 컴포넌트는 이 파일의 함수만 호출합니다.
 *
 * 데이터 출처: CheapShark API (https://apidocs.cheapshark.com/)
 *  - API 키가 필요 없고 CORS(Access-Control-Allow-Origin: *)를 허용하므로 서버/프록시 없이 브라우저에서 직접 호출합니다.
 *  - 가격은 USD, 스토어는 Steam / Epic Games Store, 플랫폼은 PC 입니다.
 *  - 커버 이미지는 Steam CDN(steamAppID 기준)이며 권리는 각 게임 권리자에게 있습니다.
 *
 * 각 목록이 의미하는 것 (CheapShark에는 "실시간 인기 순위"가 없어 아래 기준을 사용)
 *  - 인기   : Metacritic 75+ / Steam 긍정 80%+ 게임 중 Steam 리뷰 수가 많은 순  (실제 플레이어 수 순위가 아님)
 *  - 최신   : 출시일이 오늘 이전인 Steam 게임을 출시일 최신순 (리뷰 50개 미만 제외)
 *  - 할인   : Steam / Epic에서 현재 할인 중인 게임을 거래 평가(dealRating) 순
 *
 * 반환 형식(모든 목록 함수 공통): Promise<Game[]>  (실패 시 reject)
 *   Game = { id, title, coverImage, heroImage?, headerImage?, genres[], platforms[], note?,
 *            ranking?, ratingPercent?, releaseDate?, deal?: { store, regularPrice, salePrice, discountRate, currency, url? } }
 *
 * 개발용: URL에 ?mock=error | empty | slow 를 붙이면 Error / Empty / Loading 상태(예시 데이터)를 확인할 수 있습니다.
 */
(function (GF) {
  'use strict';

  var API = 'https://www.cheapshark.com/api/1.0';
  var STORE_NAMES = { '1': 'Steam', '25': 'Epic Games' };
  var TIMEOUT = 10000;              // 요청 제한 시간(ms)
  var CACHE_TTL = 10 * 60 * 1000;   // 같은 요청은 10분간 재사용 (API 호출 최소화)
  var countFormat = new Intl.NumberFormat('ko-KR');

  function mockMode() {
    return new URLSearchParams(window.location.search).get('mock');
  }

  // ---------- 공통: 요청 + 세션 캐시 ----------
  function fetchCached(url, label, trim, allowObject) {
    var key = 'gf:' + url;
    try {
      var hit = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (hit && Date.now() - hit.t < CACHE_TTL) return Promise.resolve(hit.d);
    } catch (e) { /* 저장소를 못 쓰면 캐시 없이 진행 */ }

    // 응답이 없을 때 로딩이 끝나지 않도록 10초 후 중단 → 섹션이 오류 상태(다시 시도)로 전환됨
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error(label + ' ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!Array.isArray(data) && !allowObject) throw new Error('unexpected response');
      if (trim && Array.isArray(data)) data = data.map(trim);   // 저장 용량을 줄이기 위해 필요한 필드만 남김
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* noop */ }
      return data;
    }, function (err) { clearTimeout(timer); throw err; });
  }

  function getJson(path) { return fetchCached(API + path, 'CheapShark'); }

  // ---------- FreeToGame: 국내 온라인 게임 보강 (https://www.freetogame.com) ----------
  // 무료·키 불필요·CORS 허용. 이용 조건: 출처 링크 표기(푸터에 표시). 실패해도 메인 목록은 CheapShark 만으로 동작해야 하므로 항상 [] 로 대체.
  var FTG_URL = 'https://www.freetogame.com/api/games?platform=pc';
  // 국내 개발사·퍼블리셔 (개발사 또는 퍼블리셔 이름에 포함). Guild Wars 2 는 NCsoft 퍼블리싱이지만 해외 개발작이라 제외.
  var KR_COMPANY = /nexon|ncsoft|\bnc\b|krafton|netmarble|kakao|neople|smilegate|com2us|pearl abyss|gravity|\bkog\b|shift up|devsisters|webzen|wemade|actoz|joycity|gamevil|nhn|hanbit|ndoors|bluehole|blue hole/i;
  var KR_EXCLUDE = /guild wars/i;
  var DOMESTIC_MAX = 3;                  // 최신 목록에 섞는 국내 게임 최대 개수
  var DOMESTIC_WINDOW_DAYS = 365;        // 이 기간 안에 출시된 국내 게임만 "최신"으로 취급

  function normTitle(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, ''); }

  function getFtg() {
    return fetchCached(FTG_URL, 'FreeToGame', function (g) {
      return { id: g.id, title: g.title, thumbnail: g.thumbnail, genre: g.genre, platform: g.platform,
               publisher: g.publisher, developer: g.developer, release_date: g.release_date };
    }).catch(function () { return []; });
  }

  // 같은 제목의 Steam 게임에 FreeToGame 장르를 채움 (CheapShark 는 장르를 주지 않음)
  function fillGenres(games, ftg) {
    var byTitle = {};
    ftg.forEach(function (x) { byTitle[normTitle(x.title)] = x.genre; });
    games.forEach(function (g) {
      var genre = byTitle[normTitle(g.title)];
      if (genre && (!g.genres || !g.genres.length)) g.genres = [genre];
    });
    return games;
  }

  // 최근 1년 내 출시된 국내 PC 게임 → 목록용 Game 객체 (최신 순, steamTitles 와 겹치면 제외)
  function domesticRecent(ftg, steamTitles, max) {
    var now = Date.now();
    return ftg.filter(function (x) {
      if (!/Windows/.test(x.platform || '')) return false;
      if (!(KR_COMPANY.test(x.developer || '') || KR_COMPANY.test(x.publisher || ''))) return false;
      if (KR_EXCLUDE.test(x.title)) return false;
      if (steamTitles[normTitle(x.title)]) return false;
      var t = new Date(x.release_date + 'T00:00:00').getTime();
      return t <= now && now - t <= DOMESTIC_WINDOW_DAYS * 86400000;
    }).sort(function (a, b) { return a.release_date < b.release_date ? 1 : -1; })
      .slice(0, max || DOMESTIC_MAX).map(function (x) {
        return {
          id: 'ftg-' + x.id,
          title: x.title,
          coverImage: '',
          headerImage: x.thumbnail,        // 가로형(365x206) — 최신 카드의 가로 이미지 자리에 사용
          thumbImage: '',
          genres: x.genre ? [x.genre] : [],
          platforms: ['pc'],
          releaseDate: x.release_date,
          origin: 'KR',                    // 카드에 '국내' 표시
          note: '국내 온라인 게임'
        };
      });
  }

  // dealID 는 API 가 이미 URL 인코딩된 값으로 주므로 그대로 붙임 (다시 인코딩하면 잘못된 ID 가 됨)
  function dealUrl(dealId) { return 'https://www.cheapshark.com/redirect?dealID=' + dealId; }

  function steamCover(appId) {
    return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/library_600x900.jpg';
  }

  function toIsoDate(unix) {
    return unix > 0 ? new Date(unix * 1000).toISOString().slice(0, 10) : null;
  }

  // 같은 게임(gameID)이 스토어별로 여러 줄 올 수 있어 처음 것만 사용, Steam 이미지를 못 만드는 항목은 제외
  function uniqueGames(deals) {
    var seen = {};
    return deals.filter(function (d) {
      if (!d.steamAppID || seen[d.gameID]) return false;
      seen[d.gameID] = true;
      return true;
    });
  }

  function steamArt(appId, file) {
    return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/' + file;
  }

  // ---------- 편집 선정 "국내 인기작" (인기 TOP 5 에 2개 섞음) ----------
  // 실시간 순위 데이터가 없어 사람이 고른 목록입니다(2026-11 기준 국내 대표 온라인 게임, 모두 Steam 에서 서비스).
  // 앞에서부터 TOP 5 에 쓰며, 이미 Steam 순위에 있는 게임은 건너뜁니다. 화면에는 순위 숫자 대신 'KR' 로 표시합니다.
  // ko: 상세 페이지에 보여줄 한국어 소개(GameFinder 가 직접 쓴 짧은 요약, 문단은 \n 으로 구분). 시기에 따라 내용이 바뀔 수 있는 부분은 단정하지 않고 일반적인 특징만 적음.
  var KR_PICKS = [
    { appId: '578080',  title: 'PUBG: BATTLEGROUNDS',   genre: 'Shooter',
      ko: '크래프톤이 만든 배틀로얄 슈터입니다. 많은 플레이어가 하나의 큰 맵에 떨어져 무기와 장비를 직접 찾고, 점점 좁아지는 안전 구역 안에서 끝까지 살아남는 사람이 승자가 됩니다.\n혼자, 또는 친구와 함께 팀을 이뤄 즐길 수 있고, 맵과 차량·무기 같은 요소를 어떻게 활용하느냐에 따라 전략이 크게 달라지는 것이 특징입니다.' },
    { appId: '1599340', title: 'Lost Ark',              genre: 'ARPG',
      ko: '스마일게이트 RPG가 개발한 쿼터뷰 시점의 액션 MMORPG입니다. 수많은 몬스터를 화려한 스킬로 시원하게 쓸어버리는 전투가 핵심이고, 개성이 다른 여러 클래스 가운데 원하는 캐릭터를 골라 키울 수 있습니다.\n혼자 진행하는 스토리와 모험, 여러 명이 함께 도전하는 레이드와 길드 활동까지 즐길 거리가 넓은 게임입니다.' },
    { appId: '582660',  title: 'Black Desert',          genre: 'MMORPG',
      ko: '펄어비스가 만든 오픈월드 MMORPG입니다. 직접 조작하는 콤보 중심의 액션 전투가 특징이고, 세밀하게 꾸밀 수 있는 캐릭터 커스터마이징으로도 잘 알려져 있습니다.\n전투 외에 채집·요리·무역·낚시 같은 생활 콘텐츠가 있어, 싸우지 않고 느긋하게 세계를 누비는 플레이도 가능합니다.' },
    { appId: '216150',  title: 'MapleStory',            genre: 'MMORPG',
      ko: '넥슨이 서비스하는 2D 횡스크롤 MMORPG로, 귀여운 그래픽과 오랜 역사로 널리 알려진 온라인 게임입니다. 여러 직업 가운데 하나를 골라 몬스터를 사냥하며 성장하고, 보스에 도전하는 것이 기본 흐름입니다.\n꾸준히 이어진 업데이트와 오래 즐겨 온 플레이어가 많아, 친구·길드와 함께 즐기기 좋은 게임입니다.' },
    { appId: '495910',  title: 'Dungeon Fighter Online', genre: 'Fighting',
      ko: '네오플이 개발한 2D 횡스크롤 액션 MMORPG입니다. 던전을 돌며 몬스터를 처치하는 타격감 있는 콤보 액션이 핵심이고, 직업마다 전투 방식이 크게 다릅니다.\n파티를 이뤄 던전과 레이드에 도전하며 장비를 모으고 캐릭터를 강화하는 재미가 있습니다.' }
  ];
  var KR_PICK_COUNT = 2;

  function krGame(p) {
    return {
      id: p.appId,
      title: p.title,
      coverImage: steamCover(p.appId),
      heroImage: steamArt(p.appId, 'library_hero.jpg'),
      headerImage: steamArt(p.appId, 'header.jpg'),
      thumbImage: '',
      genres: [p.genre],
      platforms: ['pc'],
      origin: 'KR',            // 카드에 '국내' 표시, 순위 숫자 대신 'KR'
      note: ''
    };
  }

  function baseGame(d) {
    return {
      id: d.steamAppID,
      title: d.title,
      coverImage: steamCover(d.steamAppID),                       // 세로 600x900 (없는 게임도 있음)
      heroImage: steamArt(d.steamAppID, 'library_hero.jpg'),      // 가로 와이드 키아트
      headerImage: steamArt(d.steamAppID, 'header.jpg'),          // 가로 460x215 (신작은 없는 경우가 있음)
      thumbImage: d.thumb || '',                                  // 231x87 캡슐 — 신작도 항상 존재하는 유일한 이미지
      genres: [],            // CheapShark는 장르를 제공하지 않음 (장르는 이후 RAWG/IGDB 연동 시 추가)
      platforms: ['pc']
    };
  }

  function reviewNote(d) {
    var n = parseInt(d.steamRatingCount, 10);
    return n > 0 ? 'Steam 리뷰 ' + countFormat.format(n) + '개' : '';
  }

  // ---------- 목록별 조회 ----------
  // ---------- Steam 인기 차트 (메인 TOP 5 + 인기 순위 페이지) ----------
  // scripts/fetch-charts.mjs 가 미리 받아 둔 Steam 공식 차트(최대 동시접속자 기준 순위·지난주 순위). 브라우저는 Steam API 를 직접 못 읽음(CORS).
  // 파일이 없거나 읽기 실패하면 null → 아래 "인기 후보 풀"(Steam 리뷰 수 기준)로 대신 표시.
  function getChart() {
    return fetchCached('data/charts/steam-most-played.json', 'Charts', null, true)
      .then(function (j) { return j && j.items && j.items.length ? j : null; }, function () { return null; });
  }

  // 차트 한 줄 → 앱 공통 game 객체. rankChange: 지난주 순위 - 이번 순위 (양수 = 상승, 0 = 변동 없음, null = 신규 진입)
  function chartGame(c) {
    return {
      id: c.appid,
      title: c.name,
      coverImage: steamCover(c.appid),
      heroImage: steamArt(c.appid, 'library_hero.jpg'),
      headerImage: steamArt(c.appid, 'header.jpg'),
      thumbImage: '',
      genres: [],
      platforms: ['pc'],
      ranking: c.rank,
      rankChange: c.lastWeekRank ? c.lastWeekRank - c.rank : null,
      note: '최대 동시접속 ' + countFormat.format(c.peak) + '명'
    };
  }

  function asOfText(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.replace(/-/g, '.') : ''; }

  // ---------- 인기 후보 풀 (차트를 못 읽을 때의 대체: Steam 리뷰 수 기준) ----------
  // CheapShark 는 리뷰 수 정렬을 지원하지 않고(Metacritic 순으로만 줌), 리뷰가 많은 게임이 여러 페이지에 흩어져 있음
  // (조건에 맞는 게임 약 2,280개 = 38페이지). 그래서 Metacritic 상위 POP_PAGES 페이지(60개씩)를 받아 직접 리뷰 수 순으로 정렬함.
  // 차트를 쓸 수 있으면 풀은 쓰지 않음(요청 8개를 아낌). 대체로 쓸 때도 메인과 순위 페이지가 같은 풀을 써야 1~5위가 어긋나지 않음. 요청 결과는 10분간 세션 캐시.
  var POP_PAGES = 8;
  var RANK_TOP = 100, RANK_STEP = 20;

  function trimDeal(d) {   // 세션 저장 용량을 줄이려고 필요한 필드만 남김
    return { gameID: d.gameID, steamAppID: d.steamAppID, title: d.title, thumb: d.thumb, storeID: d.storeID,
             steamRatingCount: d.steamRatingCount, steamRatingPercent: d.steamRatingPercent, metacriticScore: d.metacriticScore };
  }

  function popPage(n) {
    var url = API + '/deals?storeID=1&sortBy=Metacritic&metacritic=75&steamRating=80&pageSize=60&pageNumber=' + n;
    return fetchCached(url, 'CheapShark', trimDeal).catch(function () {
      // 8개를 동시에 요청하므로 한 번쯤 일시적으로 실패할 수 있어 한 번만 다시 시도
      return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return fetchCached(url, 'CheapShark', trimDeal); });
    });
  }

  var popPoolPromise = null;
  function popularPool() {
    if (!popPoolPromise) {
      var reqs = [];
      for (var i = 0; i < POP_PAGES; i++) reqs.push(popPage(i));
      popPoolPromise = Promise.all(reqs).then(function (pages) {
        var pool = uniqueGames([].concat.apply([], pages));
        pool.sort(function (a, b) { return parseInt(b.steamRatingCount, 10) - parseInt(a.steamRatingCount, 10); });
        return pool;
      });
      popPoolPromise.catch(function () { popPoolPromise = null; });   // 실패하면 다음 호출(다시 시도)에서 새로 받음
    }
    return popPoolPromise;
  }

  // 메인 TOP 5: 차트가 있으면 차트 순위(최대 동시접속자), 없으면 리뷰 수 순위로 대체
  function livePopular() {
    return getChart().then(function (chart) {
      if (chart) return Promise.all([chart.items.map(chartGame), getFtg()]);
      return Promise.all([popularPool().then(function (pool) { return pool; }), getFtg()]);
    }).then(function (res) {
      var pool = res[0];
      var fromChart = !!(pool[0] && pool[0].rankChange !== undefined);
      // 순위(1위~)는 Steam 리뷰 수 기준 실제 순위만 사용. 국내 게임은 순위가 아니라 '편집 선정'으로 마지막 자리에 섞음.
      var steamTitles = {};
      pool.slice(0, 5).forEach(function (d) { steamTitles[normTitle(d.title)] = true; });
      var picks = KR_PICKS.filter(function (p) { return !steamTitles[normTitle(p.title)]; }).slice(0, KR_PICK_COUNT).map(krGame);
      var steam = fillGenres(pool.slice(0, 5 - picks.length).map(function (d, i) {
        if (fromChart) return d;
        var g = baseGame(d);
        g.ranking = i + 1;
        g.ratingPercent = parseInt(d.steamRatingPercent, 10);
        g.note = reviewNote(d);
        return g;
      }), res[1]);
      return steam.concat(picks);
    });
  }

  function liveLatest() {
    var q = '/deals?storeID=1&sortBy=Release&steamRating=70&pageSize=60';
    var now = Date.now() / 1000;
    return Promise.all([getJson(q + '&pageNumber=0'), getJson(q + '&pageNumber=1'), getFtg()]).then(function (res) {
      // 정렬 상단에는 미래 날짜(잘못된 값 포함)가 섞여 있어 오늘 이전만 사용
      var all = uniqueGames(res[0].concat(res[1]));
      var pool = all.filter(function (d) {
        return d.releaseDate > 0 && d.releaseDate <= now && parseInt(d.steamRatingCount, 10) >= 50;
      });
      pool.sort(function (a, b) { return b.releaseDate - a.releaseDate; });
      // 국내 온라인 게임(FreeToGame)을 최대 3개 섞음: Steam 에 이미 있는 제목은 Steam 쪽만 사용
      var steamTitles = {};
      all.forEach(function (d) { steamTitles[normTitle(d.title)] = true; });
      var domestic = domesticRecent(res[2], steamTitles);
      var steam = fillGenres(pool.slice(0, 8 - domestic.length).map(function (d) {   // 가로 갤러리라 총 8개
        var g = baseGame(d);
        g.releaseDate = toIsoDate(d.releaseDate);
        g.note = reviewNote(d);
        return g;
      }), res[2]);
      // 출시일 순으로만 정렬하면 국내 게임이 맨 끝으로 밀려 스크롤해야 보이므로, Steam 최신 순 목록의 3·6·8번째 자리에 끼워 넣음
      var out = steam.slice();
      [2, 5, 7].forEach(function (pos, k) { if (domestic[k]) out.splice(Math.min(pos, out.length), 0, domestic[k]); });
      return out;
    });
  }

  // CheapShark deal 한 줄 → 앱 공통 game 객체
  function dealGame(d) {
    var g = baseGame(d);
    g.deal = {
      store: STORE_NAMES[d.storeID] || '스토어',
      regularPrice: parseFloat(d.normalPrice),
      salePrice: parseFloat(d.salePrice),
      discountRate: Math.round(parseFloat(d.savings)),
      currency: 'USD',
      url: dealUrl(d.dealID)   // 해당 스토어의 실제 상품 페이지로 이동
    };
    return g;
  }

  function liveSale() {
    var q = '/deals?storeID=1,25&onSale=1&sortBy=DealRating&lowerPrice=5&steamRating=75&pageSize=40';
    return getJson(q).then(function (deals) {
      return uniqueGames(deals).slice(0, 5).map(dealGame);
    });
  }

  // ---------- 할인 게임 전체 목록 (#/sale) ----------
  // 정렬: CheapShark 의 desc=1 은 "기본 방향을 뒤집는" 옵션입니다.
  //   추천순(DealRating)·할인율(Savings)은 기본이 높은 순, 가격(Price)은 기본이 낮은 순 → 가격 높은 순일 때만 desc=1.
  var SALE_PAGE_SIZE = 24;
  var SALE_SORTS = {
    rating:       'sortBy=DealRating',
    savings:      'sortBy=Savings',
    'price-asc':  'sortBy=Price',
    'price-desc': 'sortBy=Price&desc=1'
  };
  var SALE_STORES = { all: '1,25', '1': '1', '25': '25' };

  /** getSaleList({ store: 'all'|'1'|'25', sort: 'rating'|'savings'|'price-asc'|'price-desc', page: 0.. }) → { items, hasMore } */
  function getSaleList(opts) {
    opts = opts || {};
    var store = SALE_STORES[opts.store] ? opts.store : 'all';
    var sort = SALE_SORTS[opts.sort] ? opts.sort : 'rating';
    var page = Math.max(0, parseInt(opts.page, 10) || 0);
    var mode = mockMode();
    if (mode) {
      return mockRespond(mockSaleList(store, sort, page), mode).then(function (r) {
        return Array.isArray(r) ? { items: r, hasMore: false } : r;   // ?mock=empty 는 [] 로 응답함
      });
    }
    // 너무 싼 게임($1 미만)과 평가가 낮은 게임(Steam 긍정 70% 미만)은 제외 — 메인(5달러·75%)보다 느슨하게
    var q = '/deals?storeID=' + SALE_STORES[store] + '&onSale=1&lowerPrice=1&steamRating=70&' + SALE_SORTS[sort] +
            '&pageSize=' + SALE_PAGE_SIZE + '&pageNumber=' + page;
    return getJson(q).then(function (deals) {
      return { items: uniqueGames(deals).map(dealGame), hasMore: deals.length >= SALE_PAGE_SIZE };
    });
  }

  // ---------- 인기 순위 전체 목록 (#/rank) ----------
  /** getRankList(offset) → Promise<{ items, hasMore, next, asOf }> — 차트 TOP 100(없으면 리뷰 수 순 TOP 100)을 RANK_STEP 개씩. offset 은 처음 0 */
  function getRankList(offset) {
    offset = offset || 0;
    var mode = mockMode();
    if (mode) {
      var mockItems = GF.mockData.popular.slice(offset, offset + RANK_STEP).map(function (g, i) {
        var c = {};
        for (var k in g) c[k] = g[k];
        c.ranking = offset + i + 1;
        return c;
      });
      return mockRespond({ items: mockItems, hasMore: false }, mode).then(function (r) {
        return Array.isArray(r) ? { items: r, hasMore: false } : r;   // ?mock=empty 는 [] 로 응답함
      });
    }
    return getChart().then(function (chart) {
      if (chart) {
        return getFtg().then(function (ftg) {
          var top = chart.items.slice(0, RANK_TOP);
          var items = fillGenres(top.slice(offset, offset + RANK_STEP).map(chartGame), ftg);
          return { items: items, hasMore: offset + RANK_STEP < top.length, next: offset + RANK_STEP, asOf: asOfText(chart.rollupDate) };
        });
      }
      return Promise.all([popularPool(), getFtg()]).then(function (res) {   // 차트를 못 읽을 때: 리뷰 수 순위
        var top = res[0].slice(0, RANK_TOP);
        var items = fillGenres(top.slice(offset, offset + RANK_STEP).map(function (d, i) {
          var g = baseGame(d);
          g.ranking = offset + i + 1;
          g.ratingPercent = parseInt(d.steamRatingPercent, 10);
          g.note = reviewNote(d);
          return g;
        }), res[1]);
        return { items: items, hasMore: offset + RANK_STEP < top.length, next: offset + RANK_STEP };
      });
    });
  }

  // ---------- 신작 전체 목록 (#/new) ----------
  // CheapShark 는 출시일 정렬(sortBy=Release)의 앞쪽에 "미래 날짜"(잘못된 값 포함)가 많고(첫 페이지 60개 중 출시된 것 16개, 그중 리뷰 50개 이상 5개),
  // 한 페이지가 며칠치뿐이라 → 한 번 요청에 여러 API 페이지를 이어서 받아 최소 REL_MIN_ITEMS 개를 채움.
  // cursor = { p: 다음 API 페이지 번호 }. (국내 온라인 게임은 신작 페이지에 넣지 않음 — 메인 '최신 게임'에서만 섞어 보여줌)
  var REL_API_PAGE = 60, REL_MIN_ITEMS = 16, REL_MAX_FETCH = 3;

  function steamReleaseChunk(cursor) {
    var now = Date.now() / 1000, out = [], p = cursor.p, fetched = 0, more = true;
    function step() {
      return getJson('/deals?storeID=1&sortBy=Release&steamRating=70&pageSize=' + REL_API_PAGE + '&pageNumber=' + p).then(function (deals) {
        fetched++; p++;
        more = deals.length >= REL_API_PAGE;
        deals.forEach(function (d) {
          if (!(d.releaseDate > 0 && d.releaseDate <= now)) return;      // 미래·없는 날짜 제외
          if (parseInt(d.steamRatingCount, 10) >= 50) out.push(d);       // 리뷰 50개 미만 제외 (메인 최신 게임과 같은 기준)
        });
        if (more && uniqueGames(out).length < REL_MIN_ITEMS && fetched < REL_MAX_FETCH) return step();
      });
    }
    return step().then(function () { return { deals: uniqueGames(out), nextP: p, more: more }; });
  }

  /** getReleaseList(cursor) → Promise<{ items, hasMore, next }> — 처음엔 cursor 없이 호출 */
  function getReleaseList(cursor) {
    var mode = mockMode();
    if (mode) {
      return mockRespond({ items: GF.mockData.latest.slice(), hasMore: false }, mode).then(function (r) {
        return Array.isArray(r) ? { items: r, hasMore: false } : r;   // ?mock=empty 는 [] 로 응답함
      });
    }
    cursor = cursor || { p: 0 };
    // FreeToGame 은 장르를 채우는 데만 씀 (실패하면 장르 없이 표시)
    return Promise.all([steamReleaseChunk(cursor), getFtg()]).then(function (res) {
      var chunk = res[0];
      chunk.deals.sort(function (a, b) { return b.releaseDate - a.releaseDate; });
      var items = fillGenres(chunk.deals.map(function (d) {
        var g = baseGame(d);
        g.releaseDate = toIsoDate(d.releaseDate);
        g.note = reviewNote(d);
        return g;
      }), res[1]);
      return { items: items, hasMore: chunk.more, next: { p: chunk.nextP } };
    });
  }

  // ---------- 개발용 mock (?mock=error|empty|slow) ----------
  function mockRespond(items, mode) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (mode === 'error') reject(new Error('mock error'));
        else if (mode === 'empty') resolve([]);
        else resolve(items);
      }, mode === 'slow' ? 1500 : 0);
    });
  }

  function withDiscount(game) {
    var d = game.deal;
    var copy = {};
    for (var k in game) copy[k] = game[k];
    copy.deal = {
      store: d.store,
      regularPrice: d.regularPrice,
      salePrice: d.salePrice,
      discountRate: Math.round((1 - d.salePrice / d.regularPrice) * 100),
      currency: 'KRW'
    };
    return copy;
  }

  // 예시 데이터로 같은 필터·정렬을 흉내냄 (?mock=...)
  function mockSaleList(store, sort, page) {
    var storeName = store === '1' ? 'Steam' : store === '25' ? 'Epic Games' : null;
    var items = GF.mockData.sale.map(withDiscount).filter(function (g) { return !storeName || g.deal.store === storeName; });
    items.sort(function (a, b) {
      if (sort === 'savings') return b.deal.discountRate - a.deal.discountRate;
      if (sort === 'price-asc') return a.deal.salePrice - b.deal.salePrice;
      if (sort === 'price-desc') return b.deal.salePrice - a.deal.salePrice;
      return 0;   // 추천순: 원래 순서
    });
    return { items: page === 0 ? items : [], hasMore: false };
  }

  function pick(live, mockItems) {
    return function () {
      var mode = mockMode();
      return mode ? mockRespond(mockItems(), mode) : live();
    };
  }

  // ---------- 게임 상세 ----------
  // getGameDetail(id) → Promise<Detail>. id 종류: 숫자(Steam appId) / 'ftg-<번호>'(FreeToGame) / mock id(예시 데이터)
  // 없는 게임이면 err.code === 'notfound' 로 reject.
  function notFound() { var e = new Error('not found'); e.code = 'notfound'; return e; }

  function getStores() {
    return fetchCached(API + '/stores', 'CheapShark').catch(function () { return []; });
  }

  function getFtgDetail(ftgId) {
    return fetchCached('https://www.freetogame.com/api/game?id=' + ftgId, 'FreeToGame', null, true)
      .then(function (f) { return f && f.title ? f : null; }, function () { return null; });
  }

  function isKrCompany(dev, pub) {
    return (KR_COMPANY.test(dev || '') || KR_COMPANY.test(pub || '')) && !KR_EXCLUDE.test((dev || '') + ' ' + (pub || ''));
  }

  // FreeToGame 상세 응답 → 화면용 필드 (없으면 빈 값)
  function ftgFields(f) {
    if (!f) return { description: '', screenshots: [], developer: '', publisher: '', officialUrl: '', requirements: [], genre: '' };
    var req = f.minimum_system_requirements || {};
    return {
      description: f.description || f.short_description || '',
      screenshots: (f.screenshots || []).filter(function (s) { return s && s.image; }).map(function (s) { return { thumb: s.image, full: s.image }; }),
      developer: f.developer || '',
      publisher: f.publisher || '',
      officialUrl: f.game_url || '',
      requirements: [['OS', req.os], ['프로세서', req.processor], ['메모리', req.memory], ['그래픽', req.graphics], ['저장공간', req.storage]]
        .filter(function (r) { return r[1]; }),
      genre: f.genre || ''
    };
  }

  function ftgDetail(numId) {
    return getFtgDetail(numId).then(function (f) {
      if (!f) throw notFound();
      var x = ftgFields(f);
      return {
        id: 'ftg-' + numId, title: f.title, source: 'FreeToGame', free: true, origin: isKrCompany(f.developer, f.publisher) ? 'KR' : '',
        heroImage: '', headerImage: f.thumbnail, coverImage: '', steamAppId: '',
        genres: x.genre ? [x.genre] : [], platforms: ['pc'], releaseDate: f.release_date || null,
        rating: null, deals: [], cheapestEver: null,
        description: x.description, screenshots: x.screenshots, developer: x.developer, publisher: x.publisher,
        officialUrl: x.officialUrl, requirements: x.requirements
      };
    });
  }

  // scripts/fetch-steam.mjs 가 미리 받아 둔 Steam 상세 (같은 사이트의 파일이라 CORS 문제 없음). 없으면 null → 기존 방식으로 표시
  function getSteamStatic(appId) {
    return fetchCached('data/steam/' + appId + '.json', 'SteamData', null, true)
      .then(function (j) { return j && j.id ? j : null; }, function () { return null; });
  }

  function steamDetail(appId) {
    var kr = KR_PICKS.filter(function (p) { return p.appId === appId; })[0];
    return Promise.all([
      getJson('/deals?steamAppID=' + appId + '&storeID=1').catch(function () { return []; }),
      getStores(),
      getFtg(),
      getSteamStatic(appId),
      getChart()
    ]).then(function (res) {
      var deal = res[0][0], stores = res[1], ftgList = res[2], st = res[3];
      // 인기 차트에 있는 무료 게임(CS2·Dota 2 등)은 CheapShark 가격 정보도, 저장된 Steam 파일도 없을 수 있어 차트의 이름을 마지막 대안으로 씀
      var chartRow = res[4] && res[4].items.filter(function (c) { return c.appid === appId; })[0];
      var title = (deal && deal.title) || (kr && kr.title) || (st && st.name) || (chartRow && chartRow.name) || '';
      if (!title) throw notFound();
      var ftgRow = ftgList.filter(function (x) { return normTitle(x.title) === normTitle(title); })[0];
      // 주의: 브라우저에서는 /games?steamAppID= 요청만 막혀서(Failed to fetch) 제목으로 검색한 뒤 Steam ID 가 같은 항목을 고름
      var rowPromise = getJson('/games?title=' + encodeURIComponent(title) + '&limit=30').catch(function () { return []; })
        .then(function (rows) { return rows.filter(function (r) { return String(r.steamAppID) === appId; })[0]; });
      return rowPromise.then(function (row) {
        return Promise.all([
          row ? fetchCached(API + '/games?id=' + row.gameID, 'CheapShark', null, true).catch(function () { return null; }) : null,
          ftgRow ? getFtgDetail(ftgRow.id) : null
        ]);
      }).then(function (r2) {
        var info = r2[0], x = ftgFields(r2[1]);
        var names = {};
        stores.forEach(function (s) { names[s.storeID] = s.storeName; });
        var deals = ((info && info.deals) || []).map(function (d) {
          return { store: names[d.storeID] || '스토어', price: parseFloat(d.price), retail: parseFloat(d.retailPrice),
                   savings: Math.round(parseFloat(d.savings)), url: dealUrl(d.dealID) };
        }).sort(function (a, b) { return a.price - b.price; });
        var best = info && info.cheapestPriceEver;
        return {
          // 무료 여부: Steam 이 알려준 값(차트·저장된 상세) 우선. 없으면 "가격 정보가 없으면 무료"로 추정 (유료인데 CheapShark 에 가격이 없는 게임이 '무료'로 보이는 것을 막음)
          id: appId, title: title, source: 'Steam',
          free: chartRow ? !!chartRow.isFree : (st && typeof st.isFree === 'boolean' ? st.isFree : !deals.length),
          origin: (kr || isKrCompany(x.developer, x.publisher)) ? 'KR' : '',
          heroImage: steamArt(appId, 'library_hero.jpg'), headerImage: steamArt(appId, 'header.jpg'), coverImage: steamCover(appId), steamAppId: appId,
          genres: (st && st.genres.length) ? st.genres : (kr ? [kr.genre] : (x.genre ? [x.genre] : [])), platforms: ['pc'],
          releaseDate: deal ? toIsoDate(deal.releaseDate) : (r2[1] ? r2[1].release_date : null),
          rating: deal ? { steamPercent: parseInt(deal.steamRatingPercent, 10) || null, steamCount: parseInt(deal.steamRatingCount, 10) || null,
                           metacritic: parseInt(deal.metacriticScore, 10) || null } : null,
          deals: deals, cheapestEver: best ? { price: parseFloat(best.price), date: toIsoDate(best.date) } : null,
          // 소개 우선순위: 직접 쓴 한국어(편집 선정 국내 게임) > Steam 스토어 설명(한국어 또는 영문) > FreeToGame 영문
          description: (kr && kr.ko) || (st && st.description) || x.description,
          descLang: (kr && kr.ko) ? 'ko' : ((st && st.description) ? st.descLang : 'en'),
          descSource: (kr && kr.ko) ? 'manual' : ((st && st.description) ? 'steam' : 'ftg'),
          screenshots: (st && st.screenshots.length) ? st.screenshots : x.screenshots,
          developer: (st && st.developers.length) ? st.developers.join(', ') : x.developer,
          publisher: (st && st.publishers.length) ? st.publishers.join(', ') : x.publisher,
          officialUrl: x.officialUrl,
          requirements: (st && st.requirements.length) ? st.requirements : x.requirements,
          koreanSupport: st ? !!st.koreanSupport : null
        };
      });
    });
  }

  // 예시 데이터(?mock= 또는 숫자가 아닌 id)
  function mockDetail(id) {
    var d = GF.mockData || {}, found = null;
    [d.popular, d.latest, d.sale].forEach(function (list) {
      (list || []).forEach(function (g) { if (!found && g.id === id) found = g; });
    });
    if (!found) return Promise.reject(notFound());
    var deal = found.deal;
    return Promise.resolve({
      id: found.id, title: found.title, source: '예시 데이터', free: false, origin: '', mock: true,
      heroImage: '', headerImage: '', coverImage: found.coverImage, steamAppId: '',
      genres: found.genres || [], platforms: found.platforms || ['pc'], releaseDate: found.releaseDate || null, rating: null,
      deals: deal ? [{ store: deal.store, price: deal.salePrice, retail: deal.regularPrice, currency: 'KRW', url: '',
                       savings: Math.round((1 - deal.salePrice / deal.regularPrice) * 100) }] : [],
      cheapestEver: null, description: '', screenshots: [], developer: '', publisher: '', officialUrl: '', requirements: []
    });
  }

  function getGameDetail(id) {
    id = String(id || '');
    var isSteam = /^[0-9]+$/.test(id), isFtg = id.indexOf('ftg-') === 0;
    if (mockMode() || (!isSteam && !isFtg)) return mockDetail(id);
    return isFtg ? ftgDetail(id.slice(4)) : steamDetail(id);
  }

  GF.gameService = {
    getGameDetail: getGameDetail,
    getPopularGames: pick(livePopular, function () { return GF.mockData.popular.slice(0, 5); }),
    getLatestGames:  pick(liveLatest,  function () { return GF.mockData.latest.slice(0, 8); }),
    getSaleGames:    pick(liveSale,    function () { return GF.mockData.sale.slice(0, 5).map(withDiscount); }),
    getSaleList:     getSaleList,
    getReleaseList:  getReleaseList,
    getRankList:     getRankList,
    isMock: function () { return !!mockMode(); },
    getPlatforms:    function () { return GF.mockData.platforms; },
    getGenres:       function () { return GF.mockData.genres; },
    platformShortName: function (id) {
      var p = GF.mockData.platforms.filter(function (x) { return x.id === id; })[0];
      return p ? p.shortName : id;
    }
  };
})(window.GameFinder = window.GameFinder || {});
