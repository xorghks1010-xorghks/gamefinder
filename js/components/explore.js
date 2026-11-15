/*
 * 플랫폼·장르 탐색 — 항목 클릭 시 게임 찾기(#/find?platform= / ?genre=)로 필터를 전달합니다. (게임 찾기 페이지는 다음 단계)
 * 주요 장르(image 있음)는 크기가 다른 이미지 타일, 나머지는 텍스트 칩으로 표시합니다.
 */
(function (GF) {
  'use strict';

  var esc = GF.utils.escapeHtml;
  var SVG = function (inner) {
    return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  };

  // 심플한 플랫폼 아이콘 (브랜드 로고를 쓰지 않는 단순 도형)
  var PLATFORM_ICONS = {
    pc:      SVG('<rect x="4" y="6" width="24" height="16" rx="2"/><path d="M12 27h8M16 22v5"/>'),
    ps5:     SVG('<path d="M9 8h14l5 13a3 3 0 0 1-5 2.500L21 20h-10l-2 3.500A3 3 0 0 1 4 21L9 8Z"/><path d="M11 12v4M9 14h4"/>'),
    xbox:    SVG('<circle cx="16" cy="16" r="12"/><path d="m10.500 10.500 11 11M21.500 10.500l-11 11"/>'),
    switch2: SVG('<rect x="3" y="7" width="9" height="18" rx="3"/><rect x="20" y="7" width="9" height="18" rx="3"/><circle cx="7.500" cy="13" r="1.200"/><circle cx="24.500" cy="19" r="1.200"/>')
  };

  function createExplore(root) {
    var platforms = GF.gameService.getPlatforms();
    var genres = GF.gameService.getGenres();

    var platformHtml = platforms.map(function (p) {
      return '<li><a class="gf-tile gf-tile--platform" href="' + GF.routes.findHref({ platform: p.id }) + '">' +
        '<span class="gf-tile__icon">' + (PLATFORM_ICONS[p.id] || '') + '</span>' +
        '<span class="gf-tile__label">' + esc(p.name) + '</span>' +
      '</a></li>';
    }).join('');

    var featured = genres.filter(function (g) { return g.image; });
    var others = genres.filter(function (g) { return !g.image; });

    var featuredHtml = featured.map(function (g) {
      return '<li><a class="gf-genre-tile" href="' + GF.routes.findHref({ genre: g.id }) + '">' +
        '<img class="gf-genre-tile__img" src="' + esc(g.image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
        '<span class="gf-genre-tile__name">' + esc(g.name) + '</span>' +
        '<span class="gf-genre-tile__go" aria-hidden="true">게임 찾아보기 →</span>' +
      '</a></li>';
    }).join('');

    var genreHtml = others.map(function (g) {
      return '<li><a class="gf-tile gf-tile--genre" href="' + GF.routes.findHref({ genre: g.id }) + '">' + esc(g.name) + '</a></li>';
    }).join('');

    // root 자체가 index.html 의 <section id="explore" class="gf-section"> 이므로 내용만 채움
    root.innerHTML =
      '<div class="container">' +
        '<div class="gf-sechead">' +
          '<div class="gf-sechead__text">' +
            '<p class="gf-sechead__kicker">05 · EXPLORE</p>' +
            '<h2 class="gf-section__title" id="gf-explore-title">플랫폼·장르 탐색</h2>' +
            '<p class="gf-section__desc">원하는 플랫폼과 장르로 게임을 찾아보세요.</p>' +
          '</div>' +
        '</div>' +
        '<h3 class="gf-explore__label">플랫폼</h3>' +
        '<ul class="gf-tiles gf-tiles--platform">' + platformHtml + '</ul>' +
        '<h3 class="gf-explore__label">장르</h3>' +
        '<ul class="gf-genre-tiles">' + featuredHtml + '</ul>' +
        (genreHtml ? '<ul class="gf-tiles gf-tiles--genre">' + genreHtml + '</ul>' : '') +
      '</div>';

    // 이미지 로딩 실패 시 그라데이션 배경 + 장르명만 남김 (error는 버블링되지 않으므로 capture)
    function onImgError(e) {
      if (e.target.classList && e.target.classList.contains('gf-genre-tile__img')) e.target.remove();
    }
    root.addEventListener('error', onImgError, true);

    return {
      destroy: function () {
        root.removeEventListener('error', onImgError, true);
        root.innerHTML = '';
      }
    };
  }

  GF.createExplore = createExplore;
})(window.GameFinder = window.GameFinder || {});
