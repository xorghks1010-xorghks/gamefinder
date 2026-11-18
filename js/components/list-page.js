/*
 * 목록 페이지 공통 컴포넌트 — 제목 + (검색창) + (칩 필터 그룹들) + (정렬 select) + 한 줄형 카드 목록 + 더 보기
 * 할인 게임(#/sale)·신작(#/new)·인기 순위(#/rank)·검색(#/search)·게임 찾기(#/find) 가 이 컴포넌트를 쓰고,
 * 페이지마다 다른 부분은 설정(cfg)으로 넘깁니다. (설정은 page-configs.js)
 *
 *   const page = GameFinder.createListPage(mainEl, cfg);
 *   page.show(params, { focus })  — 주소 쿼리(#/sale?store=1&sort=savings)를 받아 목록을 보여줌
 *   page.hide() / page.destroy()
 *
 * cfg = {
 *   route, kicker, title, description, noun,            // noun: 개수 표시용 이름 ("할인 게임" → "할인 게임 24개")
 *   groups: [{ label, title?, param, def, multi?, options: [{id,label}] }],   // 칩 필터 그룹들 (주소 쿼리 이름 = param)
 *        //   multi: true 면 여러 개 선택(같은 그룹 안은 OR) → 값은 id 배열, 주소엔 param=a,b. title 이 있으면 그룹 앞에 보이는 이름을 붙임
 *   chips: {...}                                        // groups 에 그룹 하나만 쓸 때의 줄임 표기 (단일 선택)
 *   sort:  { label, param, def, options: [{id,label}] },   // 선택 사항: 정렬 select
 *   query: { param, label, placeholder, prompt, required, max },   // 선택 사항: 검색어(주소 쿼리 param). required 면 비었을 때 prompt 안내만 보여줌
 *   unsupported(params) → 안내 문구 | '',                // 선택 사항: 주소에 이 페이지가 못 다루는 필터(예: 콘솔 플랫폼)가 있으면 목록 대신 이유를 보여줌
 *   descFor(filters), docTitleFor(filters),              // 선택 사항: 필터에 따라 바뀌는 설명·문서 제목
 *   card: 'row' | 'release' | 'rankrow' | 'result',      // game-card.js 의 카드 종류
 *   firstCursor,                                        // 선택 사항: 첫 요청의 cursor (기본 0)
 *   load(filters, cursor) → Promise<{ items, hasMore, next, asOf?, total? }>,   // next 가 없으면 cursor + 1. total 이 있으면 '전체 N개 중 M개'로 표시
 *   empty (문자열 또는 filters → 문자열), note, mockNote
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
  function sameValue(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function createListPage(root, cfg) {
    var svc = GF.gameService;
    var card = GF.gameCard;
    var MOCK = svc.isMock();
    var groups = cfg.groups || (cfg.chips ? [cfg.chips] : []);
    var controls = groups.concat(cfg.sort ? [cfg.sort] : []);   // 주소 쿼리로 저장되는 칩·select 필터들
    var query = cfg.query || null;                              // 검색어(자유 입력) — 값 목록이 없음

    var filters = null;          // 현재 화면에 그려진 필터 (null = 아직 한 번도 안 그림)
    var items = [];
    var seen = {};               // 중복 제거 (같은 게임이 다음 묶음에 또 나올 수 있음)
    var cursor = null;           // 다음에 요청할 위치
    var hasMore = false;
    var seq = 0;                 // 필터를 바꾸거나 화면을 떠나면 늦게 도착한 응답을 버림
    var loadingMore = false;
    var unsupportedMsg = '';     // 지원하지 않는 필터가 주소에 있을 때의 안내 문구
    var asOf = '';               // 데이터 기준일 (load 결과에 asOf 가 있으면 개수 옆에 표시)
    var total = null;            // 조건에 맞는 전체 개수 (load 결과에 total 이 있을 때)
    var sortId = 'gf-' + cfg.route + '-sort';

    function firstCursor() { return cfg.firstCursor !== undefined ? cfg.firstCursor : 0; }
    function defOf(c) { return c.multi ? [] : c.def; }

    // 주소 쿼리 → 안전한 필터 값 (알 수 없는 값은 기본값, 다중 선택은 옵션 순서의 배열)
    function normalize(params) {
      var out = {};
      controls.forEach(function (c) {
        var v = params && params[c.param];
        if (c.multi) {
          var picked = Array.isArray(v) ? v : String(v || '').split(',');
          out[c.param] = c.options.map(function (o) { return o.id; }).filter(function (id) { return picked.indexOf(id) !== -1; });
        } else {
          out[c.param] = has(c.options, v) ? v : c.def;
        }
      });
      if (query) out[query.param] = String((params && params[query.param]) || '').trim().slice(0, query.max || 100);
      return out;
    }

    function hashFor(f) {
      var qs = [];
      controls.forEach(function (c) {
        var v = f[c.param];
        if (sameValue(v, defOf(c))) return;
        qs.push(encodeURIComponent(c.param) + '=' + encodeURIComponent(c.multi ? v.join(',') : v));
      });
      if (query && f[query.param]) qs.push(encodeURIComponent(query.param) + '=' + encodeURIComponent(f[query.param]));
      return GF.routes.hrefOf(cfg.route) + (qs.length ? '?' + qs.join('&') : '');
    }

    // 초기화 버튼을 보일지: 기본값에서 벗어난 필터가 있으면 true (선택 사항인 검색어도 포함)
    function isFiltered() {
      return controls.some(function (c) { return !sameValue(filters[c.param], defOf(c)); }) ||
             !!(query && !query.required && filters[query.param]);
    }

    // ---------- 뼈대 ----------
    var tools = '';
    groups.forEach(function (g) {
      tools += '<div class="gf-toolgroup">' +
        (g.title ? '<span class="gf-toolgroup__title">' + esc(g.title) + '</span>' : '') +
        '<div class="gf-chips" role="group" aria-label="' + esc(g.label) + '">' +
          g.options.map(function (o) {
            return '<button type="button" class="gf-chip" data-param="' + esc(g.param) + '" data-value="' + esc(o.id) + '" aria-pressed="false">' + esc(o.label) + '</button>';
          }).join('') +
        '</div></div>';
    });
    if (cfg.sort) {
      tools += '<div class="gf-select"><label for="' + sortId + '">' + esc(cfg.sort.label) + '</label>' +
        '<select id="' + sortId + '">' +
          cfg.sort.options.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('') +
        '</select></div>';
    }

    var searchForm = query
      ? '<form class="gf-page__search" role="search" action="#">' +
          '<label class="sr-only" for="gf-' + cfg.route + '-q">' + esc(query.label) + '</label>' +
          '<input id="gf-' + cfg.route + '-q" type="search" name="q" autocomplete="off" maxlength="' + (query.max || 100) + '" placeholder="' + esc(query.placeholder || '') + '">' +
          '<button type="submit">검색</button>' +
        '</form>'
      : '';

    root.innerHTML =
      '<div class="gf-page__head"><div class="container">' +
        '<p class="gf-sechead__kicker">' + esc(cfg.kicker) + '</p>' +
        '<h1 class="gf-section__title gf-page__title" tabindex="-1">' + esc(cfg.title) + '</h1>' +
        '<p class="gf-section__desc">' + esc(cfg.description) + '</p>' +
        searchForm +
        (tools ? '<div class="gf-page__tools' + (groups.length > 1 ? ' is-stacked' : '') + '">' + tools + '</div>' : '') +
      '</div></div>' +
      '<div class="container gf-page__body">' +
        '<p class="gf-page__count" role="status"></p>' +
        '<div class="gf-page__list"></div>' +
        '<div class="gf-page__more"></div>' +
        '<p class="gf-section__note">' + (MOCK && cfg.mockNote ? esc(cfg.mockNote) + ' ' : '') + esc(cfg.note || '') + '</p>' +
      '</div>';

    var titleEl = root.querySelector('.gf-page__title');
    var descEl = root.querySelector('.gf-section__desc');
    var formEl = root.querySelector('.gf-page__search');
    var inputEl = formEl && formEl.querySelector('input');
    var chipEls = root.querySelectorAll('.gf-chip');
    var sortEl = root.querySelector('#' + sortId);
    var countEl = root.querySelector('.gf-page__count');
    var listEl = root.querySelector('.gf-page__list');
    var moreEl = root.querySelector('.gf-page__more');
    var unbindImages = card.bindImageFallback(listEl);

    // ---------- 화면 조각 ----------
    function isOn(param, value) {
      var v = filters[param];
      return Array.isArray(v) ? v.indexOf(value) !== -1 : v === value;
    }

    function syncTools() {
      chipEls.forEach(function (c) { c.setAttribute('aria-pressed', String(isOn(c.dataset.param, c.dataset.value))); });
      if (sortEl) sortEl.value = filters[cfg.sort.param];
      if (inputEl) inputEl.value = filters[query.param];
      descEl.textContent = cfg.descFor ? cfg.descFor(filters) : cfg.description;
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

    function updateCount() {
      var n = total !== null && total > items.length ? '전체 ' + total + '개 중 ' + items.length + '개 표시' : items.length + '개';
      setCount(cfg.noun + ' ' + n + (asOf ? ' · 기준일 ' + asOf : ''));
    }

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
      if (typeof res.total === 'number') total = res.total;
      cursor = res.next !== undefined ? res.next : (typeof cursor === 'number' ? cursor + 1 : cursor);
      hasMore = !!res.hasMore;
    }

    function loadFirst() {
      var mine = ++seq;
      items = []; seen = {}; cursor = firstCursor(); hasMore = false; loadingMore = false; asOf = ''; total = null;
      if (unsupportedMsg) {   // 못 다루는 필터면 엉뚱한 전체 목록 대신 이유를 알려줌
        listEl.removeAttribute('aria-busy');
        listEl.innerHTML = stateHtml(unsupportedMsg, 'gf-reset', '전체 게임 보기');
        moreEl.innerHTML = '';
        setCount('');
        return;
      }
      if (query && query.required && !filters[query.param]) {   // 검색어가 꼭 필요한 페이지에서 비었으면 요청하지 않고 안내만 보여줌
        listEl.removeAttribute('aria-busy');
        listEl.innerHTML = stateHtml(query.prompt || '검색어를 입력해 주세요.', '', '');
        moreEl.innerHTML = '';
        setCount('');
        return;
      }
      showSkeleton();
      cfg.load(filters, cursor).then(function (res) {
        if (mine !== seq) return;
        listEl.removeAttribute('aria-busy');
        addItems(res.items);
        advance(res);
        if (!items.length) {
          var emptyText = typeof cfg.empty === 'function' ? cfg.empty(filters) : cfg.empty;
          listEl.innerHTML = stateHtml(emptyText || '조건에 맞는 게임이 없습니다.', 'gf-reset', isFiltered() ? '필터 초기화' : '');
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

    function onChip(chip) {
      var g = groups.filter(function (x) { return x.param === chip.dataset.param; })[0];
      var value = chip.dataset.value;
      if (g.multi) {   // 다중 선택: 눌린 칩이면 빼고, 아니면 더함
        var cur = filters[g.param].slice();
        var i = cur.indexOf(value);
        if (i === -1) cur.push(value); else cur.splice(i, 1);
        go(withChange(g.param, cur));
      } else {
        go(withChange(g.param, value));
      }
    }

    function onClick(e) {
      var chip = e.target.closest('.gf-chip');
      if (chip) { onChip(chip); return; }
      if (e.target.closest('.gf-more')) { loadMore(); return; }
      if (e.target.closest('.gf-retry')) { loadFirst(); return; }
      if (e.target.closest('.gf-reset')) { go(normalize({})); }
    }
    function onSortChange() { go(withChange(cfg.sort.param, sortEl.value)); }
    function onSearchSubmit(e) {
      e.preventDefault();
      go(withChange(query.param, inputEl.value));
      if (query.required && !inputEl.value.trim()) inputEl.focus();
    }

    root.addEventListener('click', onClick);
    if (sortEl) sortEl.addEventListener('change', onSortChange);
    if (formEl) formEl.addEventListener('submit', onSearchSubmit);

    return {
      show: function (params, opts) {
        var next = normalize(params);
        var msg = cfg.unsupported ? cfg.unsupported(params || {}) : '';
        var changed = !filters || !sameValue(next, filters) || msg !== unsupportedMsg;
        unsupportedMsg = msg;
        filters = next;
        document.title = (cfg.docTitleFor ? cfg.docTitleFor(filters) : cfg.title) + ' — ' + BASE_TITLE;
        syncTools();
        if (changed) loadFirst();   // 같은 조건으로 돌아오면(상세 → 뒤로가기) 불러온 목록을 그대로 둠
        if (opts && opts.focus) titleEl.focus({ preventScroll: true });
      },
      hide: function () { document.title = BASE_TITLE; },
      destroy: function () {
        seq++;
        root.removeEventListener('click', onClick);
        if (sortEl) sortEl.removeEventListener('change', onSortChange);
        if (formEl) formEl.removeEventListener('submit', onSearchSubmit);
        unbindImages();
        root.innerHTML = '';
      }
    };
  }

  GF.createListPage = createListPage;
})(window.GameFinder = window.GameFinder || {});
