/*
 * 목록 페이지 공통 컴포넌트 — 제목 + (칩 필터) + (정렬 select) + 한 줄형 카드 목록 + 더 보기
 * 할인 게임(#/sale)·신작(#/new) 이 이 컴포넌트를 쓰고, 페이지마다 다른 부분은 설정(cfg)으로 넘깁니다. (설정은 page-configs.js)
 *
 *   const page = GameFinder.createListPage(mainEl, cfg);
 *   page.show(params, { focus })  — 주소 쿼리(#/sale?store=1&sort=savings)를 받아 목록을 보여줌
 *   page.hide() / page.destroy()
 *
 * cfg = {
 *   route, kicker, title, description, noun,            // noun: 개수 표시용 이름 ("할인 게임" → "할인 게임 24개")
 *   chips: { label, param, def, options: [{id,label}] },   // 선택 사항: 칩 필터 (주소 쿼리 이름 = param)
 *   sort:  { label, param, def, options: [{id,label}] },   // 선택 사항: 정렬 select
 *   card: 'row' | 'release',                            // game-card.js 의 카드 종류
 *   firstCursor,                                        // 선택 사항: 첫 요청의 cursor (기본 0)
 *   load(filters, cursor) → Promise<{ items, hasMore, next }>,   // next 가 없으면 cursor + 1
 *   empty, note, mockNote
 * }
 *
 * 필터·정렬을 바꾸면 주소(hash)만 바꾸고, 실제 갱신은 main.js 의 hashchange → show() 가 합니다.
 * → 주소 공유·뒤로가기로 상태가 복원됩니다. "더 보기"는 주소에 넣지 않습니다.
 */
(function (GF) {
  'use strict';

  var esc = GF.utils.escapeHtml;
  var BASE_TITLE = 'GameFinder';
  var SKELETON_COUNT = 6;

  function has(options, id) { return options.some(function (x) { return x.id === id; }); }

  function createListPage(root, cfg) {
    var svc = GF.gameService;
    var card = GF.gameCard;
    var MOCK = svc.isMock();
    var controls = [cfg.chips, cfg.sort].filter(Boolean);   // 주소 쿼리로 저장되는 필터들

    var filters = null;          // 현재 화면에 그려진 필터 (null = 아직 한 번도 안 그림)
    var items = [];
    var seen = {};               // 중복 제거 (같은 게임이 다음 묶음에 또 나올 수 있음)
    var cursor = null;           // 다음에 요청할 위치
    var hasMore = false;
    var seq = 0;                 // 필터를 바꾸거나 화면을 떠나면 늦게 도착한 응답을 버림
    var loadingMore = false;
    var asOf = '';               // 데이터 기준일 (load 결과에 asOf 가 있으면 개수 옆에 표시)
    var sortId = 'gf-' + cfg.route + '-sort';

    function firstCursor() { return cfg.firstCursor !== undefined ? cfg.firstCursor : 0; }

    // 주소 쿼리 → 안전한 필터 값 (알 수 없는 값은 기본값)
    function normalize(params) {
      var out = {};
      controls.forEach(function (c) {
        var v = params && params[c.param];
        out[c.param] = has(c.options, v) ? v : c.def;
      });
      return out;
    }

    function hashFor(f) {
      var qs = [];
      controls.forEach(function (c) {
        if (f[c.param] !== c.def) qs.push(encodeURIComponent(c.param) + '=' + encodeURIComponent(f[c.param]));
      });
      return GF.routes.hrefOf(cfg.route) + (qs.length ? '?' + qs.join('&') : '');
    }

    function isFiltered() {
      return controls.some(function (c) { return filters[c.param] !== c.def; });
    }

    // ---------- 뼈대 ----------
    var tools = '';
    if (cfg.chips) {
      tools += '<div class="gf-chips" role="group" aria-label="' + esc(cfg.chips.label) + '">' +
        cfg.chips.options.map(function (o) {
          return '<button type="button" class="gf-chip" data-value="' + esc(o.id) + '" aria-pressed="false">' + esc(o.label) + '</button>';
        }).join('') + '</div>';
    }
    if (cfg.sort) {
      tools += '<div class="gf-select"><label for="' + sortId + '">' + esc(cfg.sort.label) + '</label>' +
        '<select id="' + sortId + '">' +
          cfg.sort.options.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('') +
        '</select></div>';
    }

    root.innerHTML =
      '<div class="gf-page__head"><div class="container">' +
        '<p class="gf-sechead__kicker">' + esc(cfg.kicker) + '</p>' +
        '<h1 class="gf-section__title gf-page__title" tabindex="-1">' + esc(cfg.title) + '</h1>' +
        '<p class="gf-section__desc">' + esc(cfg.description) + '</p>' +
        (tools ? '<div class="gf-page__tools">' + tools + '</div>' : '') +
      '</div></div>' +
      '<div class="container gf-page__body">' +
        '<p class="gf-page__count" role="status"></p>' +
        '<div class="gf-page__list"></div>' +
        '<div class="gf-page__more"></div>' +
        '<p class="gf-section__note">' + (MOCK && cfg.mockNote ? esc(cfg.mockNote) + ' ' : '') + esc(cfg.note || '') + '</p>' +
      '</div>';

    var titleEl = root.querySelector('.gf-page__title');
    var chipEls = root.querySelectorAll('.gf-chip');
    var sortEl = root.querySelector('#' + sortId);
    var countEl = root.querySelector('.gf-page__count');
    var listEl = root.querySelector('.gf-page__list');
    var moreEl = root.querySelector('.gf-page__more');
    var unbindImages = card.bindImageFallback(listEl);

    // ---------- 화면 조각 ----------
    function syncTools() {
      if (cfg.chips) {
        chipEls.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.value === filters[cfg.chips.param])); });
      }
      if (sortEl) sortEl.value = filters[cfg.sort.param];
    }

    function setCount(text) { countEl.textContent = text; }

    function showSkeleton() {
      var html = '';
      for (var i = 0; i < SKELETON_COUNT; i++) html += card.skeleton(cfg.card, i);
      listEl.setAttribute('aria-busy', 'true');
      listEl.innerHTML = '<ul class="gf-list gf-rows">' + html + '</ul>';
      moreEl.innerHTML = '';
      setCount('');
    }

    function stateHtml(text, buttonClass, buttonLabel) {
      return '<div class="gf-state"><p class="gf-state__text">' + esc(text) + '</p>' +
        (buttonLabel ? '<button type="button" class="gf-state__retry ' + buttonClass + '">' + esc(buttonLabel) + '</button>' : '') +
      '</div>';
    }

    function renderMore() {
      if (!hasMore) { moreEl.innerHTML = ''; return; }
      moreEl.innerHTML = '<button type="button" class="gf-more"' + (loadingMore ? ' disabled' : '') + '>' +
        (loadingMore ? '불러오는 중…' : '더 보기') + '</button>';
    }

    function updateCount() { setCount(cfg.noun + ' ' + items.length + '개' + (asOf ? ' · 기준일 ' + asOf : '')); }

    // ---------- 데이터 ----------
    function addItems(list) {
      var added = [];
      list.forEach(function (g) {
        if (seen[g.id]) return;
        seen[g.id] = true;
        items.push(g);
        added.push(g);
      });
      return added;
    }

    function cardsHtml(list, offset) {
      return list.map(function (g, i) { return card.render(g, cfg.card, offset + i); }).join('');
    }

    function advance(res) {
      if (res.asOf) asOf = res.asOf;
      cursor = res.next !== undefined ? res.next : (typeof cursor === 'number' ? cursor + 1 : cursor);
      hasMore = !!res.hasMore;
    }

    function loadFirst() {
      var mine = ++seq;
      items = []; seen = {}; cursor = firstCursor(); hasMore = false; loadingMore = false; asOf = '';
      showSkeleton();
      cfg.load(filters, cursor).then(function (res) {
        if (mine !== seq) return;
        listEl.removeAttribute('aria-busy');
        addItems(res.items);
        advance(res);
        if (!items.length) {
          listEl.innerHTML = stateHtml(cfg.empty || '조건에 맞는 게임이 없습니다.', 'gf-reset', isFiltered() ? '필터 초기화' : '');
          moreEl.innerHTML = '';
          setCount(cfg.noun + ' 0개');
          return;
        }
        listEl.innerHTML = '<ul class="gf-list gf-rows">' + cardsHtml(items, 0) + '</ul>';
        updateCount();
        renderMore();
      }).catch(function () {
        if (mine !== seq) return;
        listEl.removeAttribute('aria-busy');
        listEl.innerHTML = stateHtml('게임 정보를 불러오지 못했습니다.', 'gf-retry', '다시 시도');
        moreEl.innerHTML = '';
        setCount('게임 정보를 불러오지 못했습니다.');
      });
    }

    function loadMore() {
      if (loadingMore || !hasMore) return;
      var mine = seq;
      loadingMore = true;
      renderMore();
      cfg.load(filters, cursor).then(function (res) {
        if (mine !== seq) return;
        loadingMore = false;
        advance(res);
        var before = items.length;
        var added = addItems(res.items);
        var ul = listEl.querySelector('.gf-rows');
        if (ul && added.length) ul.insertAdjacentHTML('beforeend', cardsHtml(added, before));
        updateCount();
        renderMore();
        // 키보드·스크린리더 사용자가 새로 생긴 카드부터 이어서 읽도록 포커스 이동
        var firstNew = ul && ul.children[before] && ul.children[before].querySelector('a');
        if (firstNew) firstNew.focus();
      }).catch(function () {
        if (mine !== seq) return;
        loadingMore = false;
        moreEl.innerHTML = '<p class="gf-more__error" role="alert">추가 게임을 불러오지 못했습니다.</p>' +
          '<button type="button" class="gf-more">다시 시도</button>';
      });
    }

    // ---------- 이벤트 ----------
    function go(next) { window.location.hash = hashFor(next); }
    function withChange(param, value) {
      var next = {};
      for (var k in filters) next[k] = filters[k];
      next[param] = value;
      return normalize(next);
    }

    function onClick(e) {
      var chip = e.target.closest('.gf-chip');
      if (chip) { go(withChange(cfg.chips.param, chip.dataset.value)); return; }
      if (e.target.closest('.gf-more')) { loadMore(); return; }
      if (e.target.closest('.gf-retry')) { loadFirst(); return; }
      if (e.target.closest('.gf-reset')) { go(normalize({})); }
    }
    function onSortChange() { go(withChange(cfg.sort.param, sortEl.value)); }

    root.addEventListener('click', onClick);
    if (sortEl) sortEl.addEventListener('change', onSortChange);

    return {
      show: function (params, opts) {
        var next = normalize(params);
        document.title = cfg.title + ' — ' + BASE_TITLE;
        var changed = !filters || controls.some(function (c) { return next[c.param] !== filters[c.param]; }) || (!controls.length && !items.length && !listEl.firstChild);
        filters = next;
        syncTools();
        if (changed) loadFirst();   // 같은 조건으로 돌아오면(상세 → 뒤로가기) 불러온 목록을 그대로 둠
        if (opts && opts.focus) titleEl.focus({ preventScroll: true });
      },
      hide: function () { document.title = BASE_TITLE; },
      destroy: function () {
        seq++;
        root.removeEventListener('click', onClick);
        if (sortEl) sortEl.removeEventListener('change', onSortChange);
        unbindImages();
        root.innerHTML = '';
      }
    };
  }

  GF.createListPage = createListPage;
})(window.GameFinder = window.GameFinder || {});
