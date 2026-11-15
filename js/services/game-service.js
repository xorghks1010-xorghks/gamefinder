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
  function fetchCached(url, label, trim) {
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
      if (!Array.isArray(data)) throw new Error('unexpected response');
      if (trim) data = data.map(trim);   // 저장 용량을 줄이기 위해 필요한 필드만 남김
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
  function domesticRecent(ftg, steamTitles) {
    var now = Date.now();
    return ftg.filter(function (x) {
      if (!/Windows/.test(x.platform || '')) return false;
      if (!(KR_COMPANY.test(x.developer || '') || KR_COMPANY.test(x.publisher || ''))) return false;
      if (KR_EXCLUDE.test(x.title)) return false;
      if (steamTitles[normTitle(x.title)]) return false;
      var t = new Date(x.release_date + 'T00:00:00').getTime();
      return t <= now && now - t <= DOMESTIC_WINDOW_DAYS * 86400000;
    }).sort(function (a, b) { return a.release_date < b.release_date ? 1 : -1; })
      .slice(0, DOMESTIC_MAX).map(function (x) {
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
  function livePopular() {
    var q = '/deals?storeID=1&sortBy=Metacritic&metacritic=75&steamRating=80&pageSize=60';
    return Promise.all([getJson(q + '&pageNumber=0'), getJson(q + '&pageNumber=1'), getFtg()]).then(function (res) {
      var pool = uniqueGames(res[0].concat(res[1]));
      pool.sort(function (a, b) { return b.steamRatingCount - a.steamRatingCount; });
      // 인기 순위는 Steam 리뷰 수 기준이라 FreeToGame(인기 지표 없음)과 섞지 않고, 장르만 보강
      return fillGenres(pool.slice(0, 5).map(function (d, i) {
        var g = baseGame(d);
        g.ranking = i + 1;
        g.ratingPercent = parseInt(d.steamRatingPercent, 10);
        g.note = reviewNote(d);
        return g;
      }), res[2]);
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

  function liveSale() {
    var q = '/deals?storeID=1,25&onSale=1&sortBy=DealRating&lowerPrice=5&steamRating=75&pageSize=40';
    return getJson(q).then(function (deals) {
      return uniqueGames(deals).slice(0, 5).map(function (d) {
        var g = baseGame(d);
        g.deal = {
          store: STORE_NAMES[d.storeID] || '스토어',
          regularPrice: parseFloat(d.normalPrice),
          salePrice: parseFloat(d.salePrice),
          discountRate: Math.round(parseFloat(d.savings)),
          currency: 'USD',
          url: 'https://www.cheapshark.com/redirect?dealID=' + encodeURIComponent(d.dealID)   // 해당 스토어의 실제 상품 페이지로 이동
        };
        return g;
      });
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

  function pick(live, mockItems) {
    return function () {
      var mode = mockMode();
      return mode ? mockRespond(mockItems(), mode) : live();
    };
  }

  GF.gameService = {
    getPopularGames: pick(livePopular, function () { return GF.mockData.popular.slice(0, 5); }),
    getLatestGames:  pick(liveLatest,  function () { return GF.mockData.latest.slice(0, 8); }),
    getSaleGames:    pick(liveSale,    function () { return GF.mockData.sale.slice(0, 5).map(withDiscount); }),
    isMock: function () { return !!mockMode(); },
    getPlatforms:    function () { return GF.mockData.platforms; },
    getGenres:       function () { return GF.mockData.genres; },
    platformShortName: function (id) {
      var p = GF.mockData.platforms.filter(function (x) { return x.id === id; })[0];
      return p ? p.shortName : id;
    }
  };
})(window.GameFinder = window.GameFinder || {});
