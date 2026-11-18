/*
 * AI 추천 페이지 (#/ai) — 4단계: ① 플랫폼 선택 → ② 좋아하는 게임 3~10개 선택 → ③ 분석 → ④ 추천 결과 5개
 *   등록: GameFinder.pageFactories.ai = function (rootEl) { return { show, hide, destroy } }  (main.js 가 <main id="page-ai"> 를 만들어 넘김)
 *
 * 추천 계산은 js/services/recommend.js (카탈로그 안의 실제 게임만, 장르·플레이 방식·평점 기반 자체 알고리즘 — 외부 AI 서비스 아님).
 * 상태 저장: 1·2단계는 이 컴포넌트 안(메모리), 결과(4단계)는 주소에 담김 → #/ai?platform=pc&games=<id>,<id>,<id>
 *   → 결과를 주소로 공유할 수 있고, 브라우저 뒤로가기는 "다시 고르기"(2단계, 고른 게임 유지)가 됨.
 */
(function (GF) {
  'use strict';

  var esc = GF.utils.escapeHtml;
  var BASE_TITLE = 'GameFinder';
  var MIN = 3, MAX = 10, RESULT_COUNT = 5, SUGGEST = 12;
  var STEPS = ['플랫폼', '좋아하는 게임', '분석', '추천 결과'];

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, ''); }
  function ko(g) { return (GF.recommend.GENRE_KO[g] || g); }

  // 표지 → 가로 이미지 → 작은 캡슐 순으로 시도 (게임 서비스가 최근 출시작의 해시 주소를 알고 있음)
  function img(id, cls) {
    var u = GF.gameService.imageUrls(id);
    var rest = [u.header, u.thumb].filter(function (x) { return x && x !== u.cover; }).join(' ');
    return '<img class="' + cls + '" src="' + u.cover + '"' + (rest ? ' data-fallback="' + rest + '"' : '') + ' alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }

  function createAiPage(root) {
    var svc = GF.gameService;
    var card = GF.gameCard;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var state = { step: 1, platform: ['pc'], picks: [], query: '' };   // picks: 고른 게임 id 배열
    var items = null, byId = {};          // 카탈로그 (불러온 뒤)
    var lastKey = null;                   // 마지막으로 그린 주소 상태 (같으면 다시 그리지 않음)
    var seq = 0;                          // 분석 중 화면을 떠나거나 다시 시작하면 이전 타이머를 무시
    var timers = [];
    var message = '';                     // 2단계 위쪽 안내 (예: 주소의 게임이 3개 미만일 때)
    var curTitle = 'AI 추천';             // 현재 단계의 문서 제목 (다른 화면에 갔다 오면 복원)

    root.innerHTML =
      '<div class="gf-aip__head"><div class="container">' +
        '<p class="gf-sechead__kicker">AI RECOMMEND</p>' +
        '<h1 class="gf-section__title gf-page__title" tabindex="-1">AI 추천</h1>' +
        '<p class="gf-section__desc">좋아하는 게임을 알려주시면 취향에 맞는 게임 5개를 골라드려요.</p>' +
        '<ol class="gf-aip__steps" aria-label="진행 단계"></ol>' +
      '</div></div>' +
      '<div class="container gf-aip__body">' +
        '<div class="gf-aip__panel"></div>' +
        '<p class="gf-section__note">' +
          '데이터: Steam · CheapShark. 추천은 외부 AI 서비스가 아니라 GameFinder가 직접 계산합니다. 인기 PC 게임 약 600개 중에서, 고르신 게임과 ' +
          '장르·플레이 방식이 비슷하고 평가가 좋은 게임을 찾으며 ‘추천 적합도’는 그 계산 결과입니다. 분위기·스토리·그래픽 같은 취향까지는 반영하지 못합니다. ' +
          '콘솔 플랫폼은 게임 데이터가 없어 아직 선택할 수 없습니다.' +
        '</p>' +
      '</div>';

    var titleEl = root.querySelector('.gf-page__title');
    var stepsEl = root.querySelector('.gf-aip__steps');
    var panel = root.querySelector('.gf-aip__panel');
    var unbindImages = card.bindImageFallback(panel);   // 결과 카드(card.render)의 표지 이미지 대체 처리

    // ---------- 공통 ----------
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    function renderSteps(step) {
      stepsEl.innerHTML = STEPS.map(function (name, i) {
        var n = i + 1, cls = n < step ? 'is-done' : n === step ? 'is-current' : '';
        return '<li class="gf-aip__step ' + cls + '"' + (n === step ? ' aria-current="step"' : '') + '>' +
          '<span class="gf-aip__dot" aria-hidden="true">' + (n < step ? '✓' : n) + '</span>' +
          '<span class="gf-aip__stepname">' + esc(name) + '</span></li>';
      }).join('');
    }

    function setTitle(text) { curTitle = text; document.title = text + ' — ' + BASE_TITLE; }

    function focusHeading() {
      var h = panel.querySelector('.gf-aip__title');
      if (h) h.focus({ preventScroll: true });
    }

    function stateBox(text, withRetry) {
      return '<div class="gf-state"><p class="gf-state__text">' + esc(text) + '</p>' +
        (withRetry ? '<button type="button" class="gf-state__retry gf-aip__retry">다시 시도</button>' : '') + '</div>';
    }

    // ---------- 1단계: 플랫폼 ----------
    function renderStep1() {
      state.step = 1;
      renderSteps(1);
      setTitle('AI 추천 · 플랫폼 선택');
      var plats = svc.getPlatforms();
      panel.innerHTML =
        '<h2 class="gf-aip__title" tabindex="-1">어떤 플랫폼으로 즐기시나요?</h2>' +
        '<p class="gf-aip__hint">플레이할 수 있는 플랫폼을 선택해 주세요.</p>' +
        '<ul class="gf-aip__plats">' + plats.map(function (p) {
          var on = state.platform.indexOf(p.id) !== -1, enabled = p.id === 'pc';
          return '<li><button type="button" class="gf-aip__plat' + (on ? ' is-on' : '') + '" data-id="' + esc(p.id) + '" aria-pressed="' + on + '"' + (enabled ? '' : ' disabled') + '>' +
            '<span class="gf-aip__check" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
            '<span class="gf-aip__platname">' + esc(p.name) + '</span>' +
            (enabled ? '' : '<span class="gf-aip__soon">게임 데이터 준비 중</span>') +
          '</button></li>';
        }).join('') + '</ul>' +
        '<div class="gf-aip__actions"><span class="gf-aip__help" role="status">' + (state.platform.length ? '' : '플랫폼을 하나 이상 선택해 주세요.') + '</span>' +
          '<button type="button" class="gf-aip__btn gf-aip__btn--main gf-aip__next"' + (state.platform.length ? '' : ' disabled') + '>다음</button></div>';
    }

    // ---------- 2단계: 좋아하는 게임 ----------
    function suggestions() {
      var q = norm(state.query);
      var list = items.filter(function (c) { return !q || norm(c.name).indexOf(q) !== -1; })
        .sort(function (a, b) { return b.reviews - a.reviews; });
      return list.slice(0, SUGGEST);
    }

    function suggestHtml() {
      var list = suggestions(), full = state.picks.length >= MAX;
      if (!list.length) return '<p class="gf-aip__empty">‘' + esc(state.query) + '’에 해당하는 게임이 없어요. 인기 게임 약 600개 중에서 영어 이름으로 찾을 수 있어요.</p>';
      return '<ul class="gf-aip__list">' + list.map(function (c) {
        var on = state.picks.indexOf(c.id) !== -1;
        return '<li><button type="button" class="gf-aip__item' + (on ? ' is-on' : '') + '" data-id="' + esc(c.id) + '" aria-pressed="' + on + '"' + (!on && full ? ' disabled' : '') + '>' +
          img(c.id, 'gf-aip__thumb') +
          '<span class="gf-aip__itext"><b>' + esc(c.name) + '</b><small>' + esc(c.genres.map(ko).join(' · ')) + '</small></span>' +
          '<span class="gf-aip__tog" aria-hidden="true">' + (on ? '✓ 선택됨' : '+ 추가') + '</span>' +
        '</button></li>';
      }).join('') + '</ul>';
    }

    function pickedHtml() {
      if (!state.picks.length) return '<p class="gf-aip__empty">아직 고른 게임이 없어요. 위에서 게임을 찾아 추가해 주세요.</p>';
      return '<ul class="gf-aip__chosen">' + state.picks.map(function (id) {
        var c = byId[id];
        return '<li class="gf-aip__pick">' + img(id, 'gf-aip__pthumb') + '<span>' + esc(c.name) + '</span>' +
          '<button type="button" class="gf-aip__rm" data-id="' + esc(id) + '" aria-label="' + esc(c.name) + ' 삭제">×</button></li>';
      }).join('') + '</ul>';
    }

    function helpText() {
      var n = state.picks.length;
      if (n < MIN) return (MIN - n) + '개 더 고르면 추천을 받을 수 있어요.';
      if (n >= MAX) return '최대 ' + MAX + '개까지 고를 수 있어요.';
      return '추천을 받을 준비가 됐어요.';
    }

    function syncStep2() {
      var n = state.picks.length;
      panel.querySelector('.gf-aip__suggest').innerHTML = suggestHtml();
      panel.querySelector('.gf-aip__picked').innerHTML = pickedHtml();
      panel.querySelector('.gf-aip__count').textContent = n + ' / ' + MAX;
      panel.querySelector('.gf-aip__help').textContent = helpText();
      var go = panel.querySelector('.gf-aip__go');
      go.disabled = n < MIN;
    }

    function renderStep2() {
      state.step = 2;
      renderSteps(2);
      setTitle('AI 추천 · 좋아하는 게임');
      panel.innerHTML =
        '<h2 class="gf-aip__title" tabindex="-1">좋아하는 게임을 ' + MIN + '~' + MAX + '개 골라 주세요</h2>' +
        '<p class="gf-aip__hint">게임 이름(영어)으로 찾거나, 아래 인기 게임에서 골라 보세요.</p>' +
        (message ? '<p class="gf-aip__alert" role="alert">' + esc(message) + '</p>' : '') +
        '<div class="gf-aip__cols">' +
          '<section class="gf-aip__col" aria-label="게임 찾기">' +
            '<label class="sr-only" for="gf-aip-q">게임 이름 검색</label>' +
            '<input id="gf-aip-q" class="gf-aip__input" type="search" autocomplete="off" maxlength="60" placeholder="게임 이름으로 찾기 (예: elden, hades)">' +
            '<h3 class="gf-aip__sub">' + (state.query ? '검색 결과' : '많이 하는 게임') + '</h3>' +
            '<div class="gf-aip__suggest"></div>' +
          '</section>' +
          '<section class="gf-aip__col gf-aip__col--sel" aria-label="고른 게임">' +
            '<h3 class="gf-aip__sub">고른 게임 <span class="gf-aip__count" aria-hidden="true"></span></h3>' +
            '<div class="gf-aip__picked"></div>' +
          '</section>' +
        '</div>' +
        '<div class="gf-aip__actions">' +
          '<button type="button" class="gf-aip__btn gf-aip__prev">이전</button>' +
          '<span class="gf-aip__help" role="status"></span>' +
          '<button type="button" class="gf-aip__btn gf-aip__btn--main gf-aip__go" disabled>추천 받기</button>' +
        '</div>';
      panel.querySelector('.gf-aip__input').value = state.query;
      syncStep2();
      message = '';
    }

    // ---------- 3단계: 분석 ----------
    var ANALYSIS = ['선택한 게임의 장르·플레이 방식을 살펴보는 중', '플랫폼에 맞는 후보 게임을 고르는 중', '취향과의 적합도를 계산하는 중'];

    function renderAnalysis(done) {
      renderSteps(3);
      setTitle('AI 추천 · 분석 중');
      var mine = ++seq;
      panel.innerHTML =
        '<h2 class="gf-aip__title" tabindex="-1">취향을 분석하고 있어요</h2>' +
        '<div class="gf-aip__analysis" role="status"><span class="gf-spinner" aria-hidden="true"></span>' +
          '<ol class="gf-aip__alist">' + ANALYSIS.map(function (t, i) { return '<li data-i="' + i + '">' + esc(t) + '</li>'; }).join('') + '</ol></div>';
      focusHeading();
      var lis = panel.querySelectorAll('.gf-aip__alist li');
      // 계산 자체는 즉시 끝나지만, 어떤 기준으로 계산하는지 보여주려고 단계를 순서대로 표시함 (모션 줄이기 설정이면 바로 결과)
      var gap = reduceMotion.matches ? 0 : 550;
      [0, 1, 2].forEach(function (i) {
        later(function () { if (mine !== seq) return; for (var k = 0; k <= i; k++) lis[k].classList.add('is-on'); }, gap * (i + 1) - gap * 0.6);
      });
      later(function () { if (mine === seq) done(); }, gap * 3 + (gap ? 250 : 0));
    }

    // ---------- 4단계: 결과 ----------
    function renderResults(result) {
      state.step = 4;
      renderSteps(4);
      setTitle('AI 추천 · 추천 결과');
      var games = result.items.map(function (x, i) {
        var g = svc.catalogGame(x.game);
        g.fit = x.fit; g.reasons = x.reasons; g.rankNo = i + 1;
        return g;
      });
      var names = result.selected.map(function (c) { return '‘' + esc(c.name) + '’'; }).join(', ');
      panel.innerHTML =
        '<h2 class="gf-aip__title" tabindex="-1">추천 게임 ' + games.length + '개</h2>' +
        '<p class="gf-aip__hint">선택하신 게임: ' + names + '</p>' +
        (games.length < RESULT_COUNT ? '<p class="gf-aip__alert">조건에 맞는 게임이 ' + RESULT_COUNT + '개보다 적어 ' + games.length + '개만 보여드려요.</p>' : '') +
        (games.length ? '<ul class="gf-list gf-rows gf-aip__results">' + games.map(function (g, i) { return card.render(g, 'airec', i); }).join('') + '</ul>'
                      : stateBox('추천할 게임을 찾지 못했어요. 다른 게임을 골라 다시 시도해 보세요.', false)) +
        '<p class="gf-aip__fitnote">추천 적합도는 고르신 게임들과의 장르·플레이 방식 유사도에 평가·인기를 조금 더해 계산한 값이에요. 같은 취향이라면 평가가 좋은 게임이 앞에 와요.</p>' +
        '<div class="gf-aip__actions gf-aip__actions--end">' +
          '<button type="button" class="gf-aip__btn gf-aip__again">다시 고르기</button>' +
          '<button type="button" class="gf-aip__btn gf-aip__restart">처음부터</button>' +
        '</div>';
      focusHeading();
    }

    // ---------- 흐름 ----------
    function hashFor(ids) { return GF.routes.hrefOf('ai') + '?platform=pc&games=' + ids.join(','); }

    function runResults(ids) {
      state.picks = ids.slice();
      renderAnalysis(function () {
        renderResults(GF.recommend(items, ids, { count: RESULT_COUNT }));
      });
    }

    function parseIds(params) {
      var out = [];
      String(params.games || '').split(',').forEach(function (id) { if (byId[id] && out.indexOf(id) === -1) out.push(id); });
      return out.slice(0, MAX);
    }

    function render(params, opts) {
      var ids = parseIds(params);
      var key = JSON.stringify([params.games || '', params.platform || '']);
      if (key === lastKey && !(opts && opts.force)) return;
      lastKey = key;
      clearTimers();
      seq++;
      if (params.games) {
        if (ids.length >= MIN) { state.platform = ['pc']; runResults(ids); return; }
        state.picks = ids;
        message = '주소의 게임을 찾지 못했거나 ' + MIN + '개보다 적어요. 게임을 ' + MIN + '개 이상 골라 주세요.';
        state.step = 2;
      }
      if (state.step >= 2 && state.platform.length) renderStep2(); else renderStep1();
      if (opts && opts.focus) focusHeading();
    }

    // ---------- 데이터 로딩 ----------
    var pending = null;
    function ensureCatalog(then) {
      if (items) { then(); return; }
      panel.innerHTML = '<div class="gf-loading" role="status"><span class="gf-spinner" aria-hidden="true"></span><span class="gf-loading__text">게임 목록을 불러오는 중…</span></div>';
      renderSteps(state.step === 2 ? 2 : 1);
      svc.getCatalog().then(function (cat) {
        items = cat.items;
        byId = {};
        items.forEach(function (c) { byId[c.id] = c; });
        then();
      }).catch(function () {
        panel.innerHTML = stateBox('게임 정보를 불러오지 못했습니다.', true);
      });
    }

    // ---------- 이벤트 ----------
    function onClick(e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.classList.contains('gf-aip__retry')) { lastKey = null; show(pending.params, pending.opts); return; }
      if (t.classList.contains('gf-aip__plat')) {
        var id = t.dataset.id, i = state.platform.indexOf(id);
        if (i === -1) state.platform.push(id); else state.platform.splice(i, 1);
        renderStep1();
        panel.querySelector('.gf-aip__plat[data-id="' + id + '"]').focus();
        return;
      }
      if (t.classList.contains('gf-aip__next')) { renderStep2(); focusHeading(); return; }
      if (t.classList.contains('gf-aip__prev')) { renderStep1(); focusHeading(); return; }
      if (t.classList.contains('gf-aip__item')) {
        var gid = t.dataset.id, k = state.picks.indexOf(gid);
        if (k === -1) { if (state.picks.length < MAX) state.picks.push(gid); } else state.picks.splice(k, 1);
        syncStep2();
        var again = panel.querySelector('.gf-aip__item[data-id="' + gid + '"]');
        if (again) again.focus();
        return;
      }
      if (t.classList.contains('gf-aip__rm')) {
        var rid = t.dataset.id, ri = state.picks.indexOf(rid);
        if (ri !== -1) state.picks.splice(ri, 1);
        syncStep2();
        panel.querySelector('.gf-aip__input').focus();
        return;
      }
      if (t.classList.contains('gf-aip__go')) {
        if (state.picks.length < MIN) return;
        var target = hashFor(state.picks);
        if (window.location.hash === target) { lastKey = null; render(GF.routes.currentQuery(), { focus: true }); }   // 같은 주소면 hashchange 가 없으므로 직접 다시 그림
        else window.location.hash = target;
        return;
      }
      if (t.classList.contains('gf-aip__again')) { window.location.hash = GF.routes.hrefOf('ai'); return; }   // 뒤로가기와 같음: 고른 게임을 유지한 채 2단계로
      if (t.classList.contains('gf-aip__restart')) {
        state.picks = []; state.query = ''; state.step = 1; state.platform = ['pc'];
        if (window.location.hash === GF.routes.hrefOf('ai')) { lastKey = null; render({}, { focus: true }); }
        else window.location.hash = GF.routes.hrefOf('ai');
      }
    }

    function onInput(e) {
      if (!e.target.classList.contains('gf-aip__input')) return;
      state.query = e.target.value.trim();
      panel.querySelector('.gf-aip__sub').textContent = state.query ? '검색 결과' : '많이 하는 게임';
      panel.querySelector('.gf-aip__suggest').innerHTML = suggestHtml();
    }

    // 표지가 없는 게임은 가로 이미지로 바꾸고, 그것도 없으면 이미지를 숨김 (error 는 버블링되지 않아 capture 로 위임)
    function onImgError(e) {
      var im = e.target;
      if (!im.tagName || im.tagName !== 'IMG' || !im.className || im.className.indexOf('gf-aip__') !== 0) return;
      var rest = (im.dataset.fallback || '').split(' ').filter(Boolean);
      if (rest.length) { var next = rest.shift(); if (rest.length) im.dataset.fallback = rest.join(' '); else im.removeAttribute('data-fallback'); im.src = next; }
      else im.style.visibility = 'hidden';
    }

    panel.addEventListener('click', onClick);
    panel.addEventListener('input', onInput);
    panel.addEventListener('error', onImgError, true);

    function show(params, opts) {
      pending = { params: params || {}, opts: opts };
      ensureCatalog(function () {
        render(pending.params, pending.opts);
        document.title = curTitle + ' — ' + BASE_TITLE;   // 같은 상태로 돌아와 다시 그리지 않았어도 제목을 복원
      });
    }

    return {
      show: show,
      hide: function () { document.title = BASE_TITLE; },
      destroy: function () {
        clearTimers();
        seq++;
        panel.removeEventListener('click', onClick);
        panel.removeEventListener('input', onInput);
        panel.removeEventListener('error', onImgError, true);
        unbindImages();
        root.innerHTML = '';
      }
    };
  }

  GF.pageFactories = GF.pageFactories || {};
  GF.pageFactories.ai = createAiPage;
})(window.GameFinder = window.GameFinder || {});
