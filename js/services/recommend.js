/*
 * 취향 기반 추천 알고리즘 — 사용자가 고른 "좋아하는 게임"과 비슷한 게임을 카탈로그(data/catalog/games.js)에서 찾습니다.
 *   GameFinder.recommend(catalogItems, selectedIds, { count: 5 }) → { items, profile, selected }
 *     items[i] = { game(카탈로그 항목), fit(0~100 정수), reasons[문장], nearest(가장 비슷한 선택 게임 이름) }
 *
 * 외부 AI 서비스가 아니라 이 파일의 계산만으로 추천합니다 (정적 사이트라 API 키를 숨길 곳이 없음).
 * 후보는 항상 카탈로그 안의 실제 게임이고, 적합도(fit)는 아래 식으로 계산한 실제 값입니다. 이유 문장도 계산에 쓴 근거에서만 만듭니다.
 *
 * 점수 = 장르 유사도 30% + 세부 분류(FPS·오픈 월드·소울라이크 등) 유사도 18% + 플레이 방식 유사도 12% + 선택 게임과의 근접도 22% + 평가(Metacritic) 12% + 인기(리뷰 수) 6%
 *   - 장르·플레이 방식 유사도: 선택한 게임들의 "특징 빈도"(예: 4개 중 3개가 RPG → RPG 0.75)와 후보 게임의 특징을 코사인 유사도로 비교
 *   - 근접도: 후보와 선택한 게임 하나하나의 특징 겹침(Jaccard) 중 가장 큰 값 ("이 게임과 비슷하다"는 근거)
 *   - 평가·인기: 같은 취향이면 평가가 좋고 많이 하는 게임을 앞에 두려는 보정 (비중 작음)
 */
(function (GF) {
  'use strict';

  var GENRE_KO = { 'Action': '액션', 'Adventure': '어드벤처', 'RPG': 'RPG', 'Strategy': '전략', 'Simulation': '시뮬레이션',
                   'Sports': '스포츠', 'Racing': '레이싱', 'Indie': '인디', 'Casual': '캐주얼', 'Massively Multiplayer': 'MMO' };
  var MODE_KO = { single: '싱글플레이', multi: '멀티플레이', coop: '협동 플레이', pvp: 'PvP' };
  var SUB_KO = { fps: 'FPS', tps: '3인칭 슈터', shooter: '슈터', battleroyale: '배틀로얄', horror: '공포', puzzle: '퍼즐', platformer: '플랫폼',
                 fighting: '격투', roguelike: '로그라이크', soulslike: '소울라이크', metroidvania: '메트로배니아', openworld: '오픈 월드',
                 survival: '생존', sandbox: '샌드박스', turnbased: '턴제', citybuilder: '도시 건설', storyrich: '스토리 중심' };
  var W = { genre: 0.30, sub: 0.18, mode: 0.12, near: 0.22, quality: 0.12, pop: 0.06 };
  // 세부 분류가 없는 게임(데이터 없음)끼리 비교할 때 이 항목이 점수를 왜곡하지 않도록, 선택 게임에 세부 분류가 하나도 없으면 그 비중을 장르에 돌려줌

  var nf = new Intl.NumberFormat('ko-KR');
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function genresOf(c) { return c.genres || []; }
  function modesOf(c) { return c.tags || []; }
  function subsOf(c) { return c.sub || []; }

  // 선택한 게임들의 특징 빈도 (0~1): 4개 중 3개가 RPG 면 RPG = 0.75
  function profileOf(selected) {
    var g = {}, m = {}, s = {}, n = selected.length || 1;
    selected.forEach(function (c) {
      genresOf(c).forEach(function (x) { g[x] = (g[x] || 0) + 1 / n; });
      modesOf(c).forEach(function (x) { m[x] = (m[x] || 0) + 1 / n; });
      subsOf(c).forEach(function (x) { s[x] = (s[x] || 0) + 1 / n; });
    });
    return { genres: g, modes: m, subs: s, n: selected.length };
  }

  // 빈도 프로필과 후보 특징 목록의 코사인 유사도 (0~1)
  function cosine(profile, feats) {
    var dot = 0, np = 0, i;
    for (var k in profile) { np += profile[k] * profile[k]; }
    for (i = 0; i < feats.length; i++) dot += profile[feats[i]] || 0;
    var nc = Math.sqrt(feats.length);
    return np && nc ? dot / (Math.sqrt(np) * nc) : 0;
  }

  function features(c) {
    return genresOf(c).concat(modesOf(c).map(function (t) { return 'm:' + t; })).concat(subsOf(c).map(function (t) { return 's:' + t; }));
  }

  function jaccard(a, b) {
    if (!a.length || !b.length) return 0;
    var set = {}, inter = 0;
    a.forEach(function (x) { set[x] = true; });
    b.forEach(function (x) { if (set[x]) inter++; });
    return inter / (a.length + b.length - inter);
  }

  function quality(c) { return c.metacritic ? clamp((c.metacritic - 60) / 35, 0, 1) : 0.45; }   // 점수가 없으면 중간값
  function popularity(c) { return clamp(Math.log(((c.reviews || 0) + 1)) / Math.LN10 / 6.5, 0, 1); }

  // 한국어 조사(은/는, 을/를 …)가 이름 끝 글자에 따라 틀려지지 않도록, 문장은 조사가 필요 없는 형태로 만듦
  function list(arr) { return arr.join('·'); }

  // 추천 이유: 점수 계산에 실제로 쓴 근거(겹친 장르·플레이 방식·가장 비슷한 선택 게임·평가)로만 문장을 만듦
  function reasonsOf(c, profile, nearest, selectedCount) {
    var out = [];
    var sShared = subsOf(c).filter(function (x) { return (profile.subs[x] || 0) >= 0.3; })
      .sort(function (a, b) { return profile.subs[b] - profile.subs[a]; });
    var gShared = genresOf(c).filter(function (x) { return (profile.genres[x] || 0) >= 0.3; })
      .sort(function (a, b) { return profile.genres[b] - profile.genres[a]; });
    if (gShared.length) {
      var top = gShared[0], cnt = Math.round(profile.genres[top] * selectedCount);
      out.push('선택하신 ' + selectedCount + '개 중 ' + cnt + '개가 ' + (GENRE_KO[top] || top) + ' 게임이에요. 이 게임도 ' +
               list(gShared.slice(0, 3).map(function (x) { return GENRE_KO[x] || x; })) + ' 장르예요.');
    }
    if (sShared.length) {
      out.push(list(sShared.slice(0, 3).map(function (x) { return SUB_KO[x] || x; })) + ' 분류도 선택하신 게임들과 같아요.');
    }
    var mShared = modesOf(c).filter(function (x) { return (profile.modes[x] || 0) >= 0.5; })
      .sort(function (a, b) { return profile.modes[b] - profile.modes[a]; });
    if (mShared.length) {
      out.push(list(mShared.slice(0, 2).map(function (x) { return MODE_KO[x] || x; })) + ' 취향도 선택하신 게임들과 같아요.');
    }
    if (nearest && nearest.score >= 0.5) {
      out.push('‘' + nearest.name + '’ 게임과 장르·플레이 방식이 많이 겹쳐요.');
    }
    if (c.metacritic >= 85) out.push('Metacritic ' + c.metacritic + '점으로 평가가 높아요.');
    else if (c.reviews >= 100000) out.push('Steam 리뷰 ' + nf.format(c.reviews) + '개로 많은 사람이 즐겨요.');
    if (!out.length) out.push('선택하신 게임들과 비슷한 분위기의 게임이에요.');
    return out.slice(0, 3);
  }

  function recommend(items, selectedIds, opts) {
    var count = (opts && opts.count) || 5;
    var byId = {};
    items.forEach(function (c) { byId[c.id] = c; });
    var selected = (selectedIds || []).map(function (id) { return byId[id]; }).filter(Boolean);
    var profile = profileOf(selected);
    var chosen = {};
    selected.forEach(function (c) { chosen[c.id] = true; });
    var hasSubs = Object.keys(profile.subs).length > 0;
    var selFeats = selected.map(function (c) { return { name: c.name, f: features(c) }; });

    var scored = [];
    items.forEach(function (c) {
      if (chosen[c.id] || !c.reviews) return;                 // 이미 고른 게임·정보가 거의 없는 게임은 제외
      var f = features(c), nearest = null;
      selFeats.forEach(function (s) {
        var j = jaccard(f, s.f);
        if (!nearest || j > nearest.score) nearest = { name: s.name, score: j };
      });
      var g = cosine(profile.genres, genresOf(c));
      var m = cosine(profile.modes, modesOf(c));
      var sv = hasSubs ? cosine(profile.subs, subsOf(c)) : g;       // 세부 분류 데이터가 없으면 장르 점수로 대신함
      var total = W.genre * g + W.sub * sv + W.mode * m + W.near * (nearest ? nearest.score : 0) + W.quality * quality(c) + W.pop * popularity(c);
      scored.push({ game: c, total: total, nearest: nearest });
    });
    scored.sort(function (a, b) { return b.total - a.total || (b.game.reviews || 0) - (a.game.reviews || 0); });

    return {
      selected: selected,
      profile: profile,
      items: scored.slice(0, count).map(function (s) {
        return {
          game: s.game,
          fit: clamp(Math.round(s.total * 100), 1, 99),
          reasons: reasonsOf(s.game, profile, s.nearest, selected.length),
          nearest: s.nearest ? s.nearest.name : ''
        };
      })
    };
  }

  GF.recommend = recommend;
  GF.recommend.GENRE_KO = GENRE_KO;
  GF.recommend.MODE_KO = MODE_KO;
  GF.recommend.SUB_KO = SUB_KO;
})(window.GameFinder = window.GameFinder || {});
