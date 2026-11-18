/*
 * 게임 섹션 — 레이아웃이 서로 다른 3가지 형태를 하나의 컴포넌트로 만듭니다.
 *   const s = GameFinder.createGameSection(rootEl, {   // rootEl = <section> 요소
 *     id, kicker, title, description, viewAllRouteId,
 *     layout: 'rank' | 'gallery' | 'deals',
 *        rank    : 1위 대표 + 비대칭 그리드 (인기 순위)
 *        gallery : 가로 스크롤 커버 갤러리 + 이전/다음 버튼 (최신 게임)
 *        deals   : 대표 할인 1개 + 가로형 목록 (할인 게임)
 *     sampleNote,   // 예시(mock) 데이터 안내 — 있으면 "예시 데이터" 배지 표시
 *     note,         // 데이터 출처·기준 안내
 *     load: () => Promise<Game[]>
 *   });
 * 상태: loading → success | empty | error(+ 다시 시도). s.reload(), s.destroy()
 * rootEl 은 index.html 의 <section> 이며 이 컴포넌트는 그 안의 내용만 채웁니다.
 */
(function (GF) {
  'use strict';

  var esc = GF.utils.escapeHtml;
  var card = GF.gameCard;
  var SKELETON_COUNT = { rank: 5, gallery: 5, deals: 5 };

  var SVG = function (path, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  };

  function createGameSection(root, cfg) {
    var layout = cfg.layout || 'rank';
    var titleId = 'gf-sec-' + cfg.id + '-title';
    var requestSeq = 0;      // 재시도·중복 호출 시 이전 응답 무시
    var destroyed = false;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var arrows = layout === 'gallery'
      ? '<div class="gf-sechead__arrows">' +
          '<button type="button" class="gf-arrow" data-dir="-1" aria-label="이전 게임 보기">' + SVG('<path d="m15 18-6-6 6-6"/>') + '</button>' +
          '<button type="button" class="gf-arrow" data-dir="1" aria-label="다음 게임 보기">' + SVG('<path d="m9 18 6-6-6-6"/>') + '</button>' +
        '</div>'
      : '';

    // root 자체가 index.html 의 <section id="..."> 이므로 내용만 채움
    root.innerHTML =
      '<div class="container">' +
        '<div class="gf-sechead">' +
          '<div class="gf-sechead__text">' +
            (cfg.kicker ? '<p class="gf-sechead__kicker">' + esc(cfg.kicker) + '</p>' : '') +
            '<h2 class="gf-section__title" id="' + titleId + '">' + esc(cfg.title) +
              (cfg.sampleNote ? ' <span class="gf-sample-badge">예시 데이터</span>' : '') +
            '</h2>' +
            '<p class="gf-section__desc">' + esc(cfg.description) + '</p>' +
          '</div>' +
          '<div class="gf-sechead__actions">' +
            arrows +
            '<a class="gf-section__more" href="' + GF.routes.hrefOf(cfg.viewAllRouteId) + '" aria-label="' + esc(cfg.title) + ' 전체보기">전체보기' +
              SVG('<path d="m9 6 6 6-6 6"/>') +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div class="gf-section__body"></div>' +
        // 목록 전체가 아니라 이 짧은 상태 문구만 스크린리더에 알림 (aria-live 범위 최소화)
        '<p class="sr-only gf-section__status" role="status"></p>' +
        (cfg.sampleNote || cfg.note ? '<p class="gf-section__note">' + esc(cfg.sampleNote || cfg.note) + '</p>' : '') +
      '</div>';

    var body = root.querySelector('.gf-section__body');
    var statusEl = root.querySelector('.gf-section__status');
    var unbindImages = card.bindImageFallback(body);

    // ---------- 레이아웃별 마크업 ----------
    function listHtml(items) {
      if (layout === 'gallery') {
        return '<ul class="gf-list gf-list--gallery">' +
          items.map(function (g, i) { return card.render(g, 'latest', i); }).join('') + '</ul>';
      }
      if (layout === 'deals') {
        var rest = items.slice(1);
        return '<div class="gf-deals">' +
          '<div class="gf-deals__feature">' + card.render(items[0], 'feature', 0) + '</div>' +
          (rest.length
            ? '<ul class="gf-list gf-deals__list">' + rest.map(function (g, i) { return card.render(g, 'row', i + 1); }).join('') + '</ul>'
            : '') +
        '</div>';
      }
      return '<ul class="gf-list gf-list--rank">' +
        items.map(function (g, i) { return card.render(g, 'rank', i); }).join('') + '</ul>';
    }

    function skeletonHtml() {
      var n = SKELETON_COUNT[layout] || 5, html = '', i;
      if (layout === 'gallery') {
        for (i = 0; i < n; i++) html += card.skeleton('latest', i);
        return '<ul class="gf-list gf-list--gallery">' + html + '</ul>';
      }
      if (layout === 'deals') {
        for (i = 1; i < n; i++) html += card.skeleton('row', i);
        return '<div class="gf-deals"><div class="gf-deals__feature">' + card.skeleton('feature', 0) + '</div>' +
          '<ul class="gf-list gf-deals__list">' + html + '</ul></div>';
      }
      for (i = 0; i < n; i++) html += card.skeleton('rank', i);
      return '<ul class="gf-list gf-list--rank">' + html + '</ul>';
    }

    // ---------- 갤러리 끝 표시: 더 스크롤할 방향만 페이드, 끝에 닿은 화살표는 비활성 ----------
    var edgeList = null;

    function updateEdges() {
      if (!edgeList) return;
      var atStart = edgeList.scrollLeft <= 4;
      var atEnd = edgeList.scrollLeft + edgeList.clientWidth >= edgeList.scrollWidth - 4;
      edgeList.classList.toggle('has-edges', !(atStart && atEnd));
      edgeList.classList.toggle('is-at-start', atStart);
      edgeList.classList.toggle('is-at-end', atEnd);
      Array.prototype.forEach.call(root.querySelectorAll('.gf-arrow'), function (btn) {
        var blocked = btn.dataset.dir === '-1' ? atStart : atEnd;
        if (blocked) btn.setAttribute('aria-disabled', 'true');
        else btn.removeAttribute('aria-disabled');
      });
    }

    function unbindEdges() {
      if (edgeList) edgeList.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
      edgeList = null;
    }

    function bindEdges() {
      unbindEdges();
      if (layout !== 'gallery') return;
      edgeList = body.querySelector('.gf-list--gallery');
      if (!edgeList) return;
      edgeList.addEventListener('scroll', updateEdges, { passive: true });
      window.addEventListener('resize', updateEdges);
      updateEdges();
    }

    function showLoading() {
      unbindEdges();
      body.setAttribute('aria-busy', 'true');
      statusEl.textContent = '';
      body.innerHTML = skeletonHtml();
    }

    function showSuccess(items) {
      body.removeAttribute('aria-busy');
      body.innerHTML = listHtml(items);
      statusEl.textContent = cfg.title + ' ' + items.length + '개를 불러왔습니다.';
      GF.motion.countUp(body.querySelectorAll('.gf-card__off'));   // 할인율 숫자 카운트업
      bindEdges();
    }

    function showMessage(text, withRetry) {
      unbindEdges();
      body.removeAttribute('aria-busy');
      statusEl.textContent = cfg.title + ': ' + text;
      body.innerHTML = '<div class="gf-state">' +
        '<p class="gf-state__text">' + esc(text) + '</p>' +
        (withRetry ? '<button type="button" class="gf-state__retry">다시 시도</button>' : '') +
      '</div>';
    }

    // ---------- 이벤트 ----------
    function onBodyClick(e) {
      if (e.target.closest('.gf-state__retry')) load();
    }

    // 갤러리 이전/다음: 보이는 폭의 80%만큼 스크롤
    function onRootClick(e) {
      var btn = e.target.closest('.gf-arrow');
      if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
      var list = body.querySelector('.gf-list--gallery');
      if (!list) return;
      list.scrollBy({ left: Number(btn.dataset.dir) * list.clientWidth * 0.8, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    function load() {
      var seq = ++requestSeq;
      showLoading();
      cfg.load().then(function (items) {
        if (destroyed || seq !== requestSeq) return;
        if (!items || !items.length) showMessage('표시할 게임이 없습니다.', false);
        else showSuccess(items);
      }).catch(function () {
        if (destroyed || seq !== requestSeq) return;
        showMessage('게임 정보를 불러오지 못했습니다.', true);
      });
    }

    body.addEventListener('click', onBodyClick);
    root.addEventListener('click', onRootClick);
    load();

    return {
      reload: load,
      destroy: function () {
        destroyed = true;
        unbindEdges();
        body.removeEventListener('click', onBodyClick);
        root.removeEventListener('click', onRootClick);
        unbindImages();
        root.innerHTML = '';
      }
    };
  }

  GF.createGameSection = createGameSection;
})(window.GameFinder = window.GameFinder || {});
