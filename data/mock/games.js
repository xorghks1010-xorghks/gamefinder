/*
 * 메인 페이지 Mock Data — 개발 단계 UI 확인용 예시 데이터입니다.
 * 이 파일은 js/services/game-service.js 를 통해서만 읽습니다. (API 연동 시 서비스만 교체)
 *
 * [출처 / 확인 여부]
 *  - 게임명·장르·플랫폼 : 실제 게임 정보
 *  - releaseDate       : Steam 스토어 페이지 기준 PC 출시일 (2025-xx 확인)
 *  - coverImage        : Steam CDN 커버(library_600x900.jpg). 개발 미리보기용 외부 링크이며
 *                        이미지 저작권은 각 게임 권리자에게 있습니다. 배포 전 사용 조건 재확인/교체 필요.
 *  - ranking / rating / price / discountRate / store : 확인되지 않은 "예시 값"입니다.
 *                        실제 순위·평점·가격·할인 정보가 아닙니다. (isSample: true 로 표시)
 */
(function (GF) {
  'use strict';

  var steamCover = function (appId) {
    return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/library_600x900.jpg';
  };

  // 게임 기본 정보 (공통 카탈로그)
  var CATALOG = {
    cs2:          { id: 'cs2',          title: 'Counter-Strike 2',             genres: ['FPS'],               platforms: ['pc'],                    coverImage: steamCover(730) },
    bg3:          { id: 'bg3',          title: "Baldur's Gate 3",              genres: ['RPG'],               platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(1086940) },
    eldenring:    { id: 'eldenring',    title: 'ELDEN RING',                   genres: ['RPG', 'Action'],     platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(1245620) },
    cyberpunk:    { id: 'cyberpunk',    title: 'Cyberpunk 2077',               genres: ['RPG', 'Action'],     platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(1091500) },
    helldivers2:  { id: 'helldivers2',  title: 'HELLDIVERS 2',                 genres: ['Action', 'FPS'],     platforms: ['pc', 'ps5'],            coverImage: steamCover(553850) },

    silksong:     { id: 'silksong',     title: 'Hollow Knight: Silksong',      genres: ['Adventure', 'Action'], platforms: ['pc', 'ps5', 'xbox'],   coverImage: steamCover(1030300), releaseDate: '2025-09-04' },
    doomtda:      { id: 'doomtda',      title: 'DOOM: The Dark Ages',          genres: ['FPS'],               platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(3017860), releaseDate: '2025-05-14' },
    expedition33: { id: 'expedition33', title: 'Clair Obscur: Expedition 33',  genres: ['RPG'],               platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(1903340), releaseDate: '2025-04-24' },
    mhwilds:      { id: 'mhwilds',      title: 'Monster Hunter Wilds',         genres: ['Action', 'RPG'],     platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(2246340), releaseDate: '2025-02-27' },
    kcd2:         { id: 'kcd2',         title: 'Kingdom Come: Deliverance II', genres: ['RPG'],               platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(1771300), releaseDate: '2025-02-04' },

    hades:        { id: 'hades',        title: 'Hades',                        genres: ['Action'],            platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(1145360) },
    stardew:      { id: 'stardew',      title: 'Stardew Valley',               genres: ['Simulation'],        platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(413150) },
    hollowknight: { id: 'hollowknight', title: 'Hollow Knight',                genres: ['Adventure'],         platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(367520) },
    witcher3:     { id: 'witcher3',     title: 'The Witcher 3: Wild Hunt',     genres: ['RPG'],               platforms: ['pc', 'ps5', 'xbox'],     coverImage: steamCover(292030) },
    civ6:         { id: 'civ6',         title: "Sid Meier's Civilization VI",  genres: ['Strategy'],          platforms: ['pc'],                    coverImage: steamCover(289070) }
  };

  function extend(base, extra) {
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var j in extra) out[j] = extra[j];
    return out;
  }

  // 섹션별 예시 구성 — 순위/평점/가격/할인은 모두 예시 값 (isSample)
  var POPULAR = [
    extend(CATALOG.cs2,         { ranking: 1, rating: 4.5, isSample: true }),
    extend(CATALOG.bg3,         { ranking: 2, rating: 4.9, isSample: true }),
    extend(CATALOG.eldenring,   { ranking: 3, rating: 4.7, isSample: true }),
    extend(CATALOG.cyberpunk,   { ranking: 4, rating: 4.3, isSample: true }),
    extend(CATALOG.helldivers2, { ranking: 5, rating: 4.2, isSample: true })
  ];

  var LATEST = [
    extend(CATALOG.silksong,     { isSample: true }),
    extend(CATALOG.doomtda,      { isSample: true }),
    extend(CATALOG.expedition33, { isSample: true }),
    extend(CATALOG.mhwilds,      { isSample: true }),
    extend(CATALOG.kcd2,         { isSample: true })
  ];

  // 정가·할인가(KRW)는 예시 값. 할인율은 서비스에서 계산합니다.
  var SALE = [
    extend(CATALOG.hades,        { deal: { store: 'Steam',       regularPrice: 30000, salePrice: 15000 }, isSample: true }),
    extend(CATALOG.stardew,      { deal: { store: 'Steam',       regularPrice: 18000, salePrice: 12600 }, isSample: true }),
    extend(CATALOG.hollowknight, { deal: { store: 'Epic Games',  regularPrice: 17000, salePrice: 8500 },  isSample: true }),
    extend(CATALOG.witcher3,     { deal: { store: 'Steam',       regularPrice: 40000, salePrice: 10000 }, isSample: true }),
    extend(CATALOG.civ6,         { deal: { store: 'Epic Games',  regularPrice: 66000, salePrice: 16500 }, isSample: true })
  ];

  var PLATFORMS = [
    { id: 'pc',      name: 'PC',                 shortName: 'PC' },
    { id: 'ps5',     name: 'PlayStation 5',      shortName: 'PS5' },
    { id: 'xbox',    name: 'Xbox Series X|S',    shortName: 'Xbox' },
    { id: 'switch2', name: 'Nintendo Switch 2',  shortName: 'Switch 2' }
  ];

  // Open World 는 장르가 아니라 태그이므로 포함하지 않음 (plan.md 06)
  // image: 주요 장르 타일 배경(Steam CDN 아트워크, 개발 미리보기용 — 배포 전 사용 조건 확인/교체 필요)
  var steamHero = function (appId) {
    return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + appId + '/library_hero.jpg';
  };
  var GENRES = [
    { id: 'rpg', name: 'RPG', image: steamHero(1086940) },
    { id: 'action', name: 'Action', image: steamHero(1145360) },
    { id: 'horror', name: 'Horror', image: steamHero(739630), find: { sub: 'horror' } },      // find: 게임 찾기로 보낼 필터 (Steam 장르가 아니라 세부 분류)
    { id: 'fps', name: 'FPS', image: steamHero(730), find: { sub: 'fps' } },
    { id: 'strategy', name: 'Strategy', image: steamHero(289070) },
    { id: 'adventure', name: 'Adventure', image: steamHero(367520) },
    { id: 'simulation', name: 'Simulation', image: steamHero(413150) },
    { id: 'sports', name: 'Sports' },
    { id: 'racing', name: 'Racing' },
    { id: 'puzzle', name: 'Puzzle', find: { sub: 'puzzle' } }
  ];

  GF.mockData = {
    popular: POPULAR,
    latest: LATEST,
    sale: SALE,
    platforms: PLATFORMS,
    genres: GENRES
  };
})(window.GameFinder = window.GameFinder || {});
