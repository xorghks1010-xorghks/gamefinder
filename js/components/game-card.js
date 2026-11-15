/*
 * 공통 게임 카드 — 용도별 5가지 형태를 한 곳에서 만듭니다. (게임 찾기·상세 등에서도 재사용)
 *   GameFinder.gameCard.render(game, type, index) → HTML 문자열 (<li> 또는 <article>)
 *     type: 'rank'    인기 순위 카드 — 이미지 전면 + 큰 순위 숫자 + 하단 그라데이션 정보 (index 0 = 1위 대표)
 *           'latest'  최신 게임 카드 — 가로 갤러리용 커버 + 출시일 배지
 *           'feature' 대표 할인 카드 — 큰 키아트 + 할인율·가격·스토어 이동 버튼
 *           'row'     가로형 할인 카드 — 작은 커버 + 스토어·가격·할인율
 *           'default' 일반 카드 — 3:4 커버 + 제목/메타
 *     ('popular' → 'rank', 'sale' → 'row' 별칭 지원)
 *   GameFinder.gameCard.skeleton(type, index) → 로딩용 HTML
 *   GameFinder.gameCard.bindImageFallback(containerEl) → 이미지 실패 시 대체 이미지 → 디자인된 Fallback
 *
 * 이미지는 항상 [우선 이미지, ...대체 이미지] 순서로 시도하고, 전부 실패하면 img 를 제거해
 * 그 아래 깔려 있는 그라데이션 Fallback(머리글자 + 게임명)이 보이게 합니다.
 */
(function (GF) {
  'use strict';

  var esc = GF.utils.escapeHtml;
  var ALIAS = { popular: 'rank', sale: 'row' };

  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.500 2.900 6 6.600.9-4.800 4.600 1.200 6.500-5.900-3.200-5.900 3.200 1.200-6.500L2.500 9.400l6.600-.9L12 2.500Z"/></svg>';
  var EXTERNAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  // 타입·순번에 따라 쓰는 이미지 후보 (앞쪽이 우선)
  function imageCandidates(g, type, i) {
    var list;
    // 마지막 후보는 항상 thumbImage(작은 캡슐): 신작처럼 큰 이미지가 없는 게임도 이미지는 보이게 함
    if (type === 'rank') list = (i === 1) ? [g.heroImage, g.coverImage, g.headerImage] : [g.coverImage, g.headerImage];
    else if (type === 'latest') list = [g.headerImage, g.coverImage];
    else if (type === 'feature') list = [g.heroImage, g.headerImage, g.coverImage];
    else list = [g.coverImage, g.headerImage];
    list.push(g.thumbImage);
    return list.filter(function (u, k) { return u && list.indexOf(u) === k; });
  }

  function imgTag(g, type, i) {
    var urls = imageCandidates(g, type, i);
    if (!urls.length) return '';
    // 카드 안에 게임명이 텍스트로 있으므로 이미지는 장식 처리(alt="")
    return '<img class="gf-card__img" src="' + esc(urls[0]) + '"' +
      (urls.length > 1 ? ' data-fallback="' + esc(urls.slice(1).join(' ')) + '"' : '') +
      ' alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }

  // 이미지가 모두 없거나 실패했을 때 보이는 디자인된 대체 영역 (img 아래에 항상 깔려 있음)
  function fallback(g) {
    var t = String(g.title || '');
    return '<div class="gf-card__fallback" aria-hidden="true">' +
      '<span class="gf-card__mono">' + esc(t.charAt(0).toUpperCase()) + '</span>' +
      '<span class="gf-card__fbtitle">' + esc(t) + '</span>' +
    '</div>';
  }

  function media(g, type, i, extra) {
    // 작은 캡슐만 있는 게임은 같은 이미지를 블러 배경(--art)으로 깔아 빈 느낌을 줄임
    var art = g.thumbImage ? ' has-art" style="--art:url(\'' + esc(g.thumbImage) + '\')' : '';
    return '<div class="gf-card__media' + art + '">' + fallback(g) + imgTag(g, type, i) + (extra || '') + '</div>';
  }

  // "장르(없으면 보조 문구) · 플랫폼" 한 줄
  function metaLine(g) {
    var platforms = (g.platforms || []).map(GF.gameService.platformShortName).join(' · ');
    var left = (g.genres && g.genres.length) ? g.genres.join(', ') : (g.note || '');
    return esc([left, platforms, g.origin === 'KR' ? '국내' : ''].filter(Boolean).join(' · '));
  }

  function scoreText(g) {
    if (typeof g.ratingPercent === 'number') return g.ratingPercent + '%';   // 실데이터: Steam 긍정 평가
    if (typeof g.rating === 'number') return g.rating.toFixed(1);            // 예시 데이터: 5점 만점
    return '';
  }

  function href(g) { return GF.routes.gameHref(g.id); }

  // ---------- 인기 순위 카드 ----------
  function rank(g, i) {
    var n = g.ranking || (i + 1);
    var kr = g.origin === 'KR';                       // 편집 선정 국내 인기작: 순위 숫자 대신 'KR'
    var score = scoreText(g);
    return (
      '<li class="gf-item gf-item--rank gf-item--r' + (i + 1) + '">' +
        '<a class="gf-card gf-card--rank" href="' + href(g) + '" data-game-id="' + esc(g.id) + '">' +
          media(g, 'rank', i) +
          '<span class="gf-card__shade"></span>' +
          '<span class="gf-card__rank" aria-hidden="true">' + (kr ? 'KR' : pad(n)) + '</span>' +
          (score ? '<span class="gf-card__chip"><span class="gf-card__star">' + STAR + '</span>' + score + '</span>' : '') +
          '<div class="gf-card__info">' +
            '<h3 class="gf-card__title"><span class="sr-only">' + (kr ? '국내 인기작 ' : n + '위 ') + '</span>' + esc(g.title) + '</h3>' +
            '<p class="gf-card__meta">' + metaLine(g) + '</p>' +
          '</div>' +
        '</a>' +
      '</li>'
    );
  }

  // ---------- 최신 게임 카드 ----------
  function latest(g, i) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(g.releaseDate || '');
    var badge = '<span class="gf-card__date-badge"><small>출시일 미정</small></span>';
    var isNew = '';
    if (m) {
      badge = '<span class="gf-card__date-badge"><b>' + m[2] + '.' + m[3] + '</b><small>' + m[1] + '</small></span>';
      var days = (Date.now() - new Date(g.releaseDate + 'T00:00:00').getTime()) / 86400000;
      if (days >= 0 && days <= 14) isNew = '<span class="gf-card__new">NEW</span>';
    }
    return (
      '<li class="gf-item gf-item--latest">' +
        '<a class="gf-card gf-card--latest" href="' + href(g) + '" data-game-id="' + esc(g.id) + '">' +
          media(g, 'latest', i, '<span class="gf-card__shade"></span>' + badge + isNew) +
          '<div class="gf-card__body">' +
            '<h3 class="gf-card__title">' + esc(g.title) + '</h3>' +
            '<p class="gf-card__meta">' + metaLine(g) + '</p>' +
          '</div>' +
        '</a>' +
      '</li>'
    );
  }

  // 스토어 이름 → 색 구분용 data 속성
  function storeChip(name, cls) {
    return '<span class="' + cls + '" data-store="' + esc(name) + '"><i class="gf-store__dot"></i>' + esc(name) + '</span>';
  }

  function priceHtml(d) {
    return '<span class="gf-card__price-now">' + GF.utils.formatPrice(d.salePrice, d.currency) + '</span>' +
           '<s class="gf-card__price-old">' + GF.utils.formatPrice(d.regularPrice, d.currency) + '</s>';
  }

  // ---------- 대표 할인 카드 ----------
  function feature(g, i) {
    var d = g.deal;
    if (!d) return row(g, i);
    var saved = d.regularPrice - d.salePrice;
    return (
      '<article class="gf-card gf-card--feature" data-game-id="' + esc(g.id) + '">' +
        media(g, 'feature', i) +
        '<span class="gf-card__shade"></span>' +
        '<div class="gf-card__content">' +
          storeChip(d.store, 'gf-store gf-store--chip') +
          '<p class="gf-card__off" aria-label="' + d.discountRate + '퍼센트 할인">-' + d.discountRate + '%</p>' +
          '<h3 class="gf-card__title"><a class="gf-card__stretch" href="' + href(g) + '">' + esc(g.title) + '</a></h3>' +
          '<p class="gf-card__price">' + priceHtml(d) + '</p>' +
          (saved > 0 ? '<p class="gf-card__save">정가 대비 ' + GF.utils.formatPrice(saved, d.currency) + ' 절약</p>' : '') +
          (d.url ? '<a class="gf-btn" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer">' + esc(d.store) + '에서 보기' + EXTERNAL + '</a>' : '') +
        '</div>' +
      '</article>'
    );
  }

  // ---------- 가로형 할인 카드 ----------
  function row(g, i) {
    var d = g.deal;
    return (
      '<li class="gf-item gf-item--row">' +
        '<article class="gf-card gf-card--row" data-game-id="' + esc(g.id) + '">' +
          media(g, 'row', i) +
          '<div class="gf-card__body">' +
            (d ? storeChip(d.store, 'gf-store') : '') +
            '<h3 class="gf-card__title"><a class="gf-card__stretch" href="' + href(g) + '">' + esc(g.title) + '</a></h3>' +
            (d ? '<p class="gf-card__price">' + priceHtml(d) + '</p>' : '<p class="gf-card__meta">가격 정보 없음</p>') +
          '</div>' +
          (d ? '<span class="gf-card__off-badge" aria-label="' + d.discountRate + '퍼센트 할인">-' + d.discountRate + '%</span>' : '') +
        '</article>' +
      '</li>'
    );
  }

  // ---------- 일반 카드 ----------
  function plain(g, i) {
    return (
      '<li class="gf-item gf-item--default">' +
        '<a class="gf-card gf-card--default" href="' + href(g) + '" data-game-id="' + esc(g.id) + '">' +
          media(g, 'default', i) +
          '<div class="gf-card__body">' +
            '<h3 class="gf-card__title">' + esc(g.title) + '</h3>' +
            '<p class="gf-card__meta">' + metaLine(g) + '</p>' +
          '</div>' +
        '</a>' +
      '</li>'
    );
  }

  var RENDER = { rank: rank, latest: latest, feature: feature, row: row, 'default': plain };

  function render(game, type, index) {
    var t = ALIAS[type] || type;
    return (RENDER[t] || plain)(game, index || 0);
  }

  // ---------- 로딩 스켈레톤 ----------
  function skeleton(type, index) {
    var t = ALIAS[type] || type;
    var i = index || 0;
    if (t === 'rank') {
      return '<li class="gf-item gf-item--rank gf-item--r' + (i + 1) + '" aria-hidden="true"><div class="gf-card gf-card--rank gf-skel"></div></li>';
    }
    if (t === 'feature') return '<div class="gf-card gf-card--feature gf-skel" aria-hidden="true"></div>';
    if (t === 'row') return '<li class="gf-item gf-item--row" aria-hidden="true"><div class="gf-card gf-card--row gf-skel"></div></li>';
    return '<li class="gf-item gf-item--' + t + '" aria-hidden="true"><div class="gf-card gf-card--' + t + '">' +
      '<div class="gf-card__media gf-skel"></div>' +
      '<div class="gf-card__body"><span class="gf-skel gf-skel__line gf-skel__line--title"></span><span class="gf-skel gf-skel__line"></span></div>' +
    '</div></li>';
  }

  // img 의 error 이벤트는 버블링되지 않으므로 capture 로 위임.
  // 대체 이미지가 남아 있으면 다음 것으로 교체하고, 없으면 img 를 제거해 Fallback 영역이 보이게 함.
  function bindImageFallback(container) {
    function onError(e) {
      var img = e.target;
      if (!img.classList || !img.classList.contains('gf-card__img')) return;
      var rest = (img.dataset.fallback || '').split(' ').filter(Boolean);
      if (!rest.length) { img.remove(); return; }
      var next = rest.shift();
      if (rest.length) img.dataset.fallback = rest.join(' '); else img.removeAttribute('data-fallback');
      // 가로형 이미지로 바뀌면 세로 칸에서 잘리지 않도록 표시 방식을 바꿈
      if (/capsule_/.test(next)) img.classList.add('is-capsule');        // 231x87: 원본 크기로 중앙 배치
      else if (/header\.jpg/.test(next)) img.classList.add('is-wide');   // 460x215: 폭에 맞춰 비율 유지
      img.src = next;
    }
    container.addEventListener('error', onError, true);
    return function unbind() { container.removeEventListener('error', onError, true); };
  }

  GF.gameCard = { render: render, skeleton: skeleton, bindImageFallback: bindImageFallback };
})(window.GameFinder = window.GameFinder || {});
