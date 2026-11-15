/*
 * AI 추천 전용 섹션 — 다크 네이비 + 블루·퍼플 그라데이션으로 다른 게임 목록 섹션과 구분합니다.
 * AI 추천 페이지로 연결하는 소개 영역이며, 취향 문구를 누르면 "예시 추천 미리보기"를 보여줍니다. (plan.md 04-3)
 *
 * 주의: 실제 AI 호출이 아닙니다. 문구별로 미리 정해 둔 게임 3개와 추천 이유를 보여주는 데모이며,
 *       화면에도 "예시 미리보기"로 표시합니다. 실제 추천은 AI 추천 페이지(#/ai, 미구현)에서 제공할 예정입니다.
 * 게임 정보는 data/mock/games.js 의 예시 데이터에서 id 로 찾아 씁니다. (추천 결과는 항상 GameFinder 안에 있는 게임)
 */
(function (GF) {
  'use strict';

  // 취향 문구 → 예시 추천 3개 (gameId, 추천 이유). 적합도 같은 숫자는 만들어내지 않습니다.
  var DEMOS = [
    {
      label: '스토리가 탄탄한 RPG',
      picks: [
        ['bg3',          '선택마다 이야기가 갈라지는 대작 RPG라 스토리를 중시하는 취향에 잘 맞아요.'],
        ['expedition33', '턴제 전투와 감성적인 서사가 돋보이는 최신 RPG예요.'],
        ['witcher3',     '방대한 퀘스트 하나하나에 이야기가 담긴 RPG의 대표작이에요.']
      ]
    },
    {
      label: '혼자 즐기는 힐링 게임',
      picks: [
        ['stardew',      '농사와 마을 생활을 내 속도대로 즐길 수 있어 혼자 쉬어가기 좋아요.'],
        ['hollowknight', '고요한 분위기 속에서 천천히 탐험하는 혼자만의 모험이에요.'],
        ['civ6',         '턴제라 시간에 쫓기지 않고 느긋하게 문명을 키울 수 있어요.']
      ]
    },
    {
      label: '친구와 함께하는 협동 액션',
      picks: [
        ['helldivers2',  '친구와 호흡을 맞춰 임무를 깨는 협동 슈터예요.'],
        ['mhwilds',      '함께 거대한 몬스터를 사냥하는 멀티플레이 액션이에요.'],
        ['cs2',          '팀을 이뤄 승부를 겨루는 대표적인 팀 기반 FPS예요.']
      ]
    }
  ];

  // 추천 흐름 안내 (plan.md AI 추천 STEP 1~4)
  var STEPS = [
    ['01', '플랫폼 선택', '플레이할 수 있는 기기를 고르세요'],
    ['02', '좋아한 게임 3개 이상', '취향의 기준이 되는 게임을 알려주세요'],
    ['03', 'AI가 5개 추천', '추천 이유와 함께 보여드려요']
  ];

  // 궤도 비주얼 주변에 떠 있는 장식용 태그
  var FLOATING = ['Open World', 'Story Rich', 'Souls-like'];

  var THINK_MS = 650;   // "분석 중" 연출 시간 (모션 줄이기 환경에서는 0)

  var ORBIT = '<svg class="gf-orbit gf-ai__orbit" viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">' +
    '<circle cx="200" cy="200" r="190" stroke-dasharray="2 9" opacity=".6"/>' +
    '<g class="gf-orbit__ring gf-orbit__ring--a"><ellipse cx="200" cy="200" rx="170" ry="66"/><circle cx="370" cy="200" r="7" fill="currentColor"/></g>' +
    '<g class="gf-orbit__ring gf-orbit__ring--b"><ellipse cx="200" cy="200" rx="130" ry="130"/><circle cx="200" cy="70" r="5" fill="currentColor"/><circle cx="82" cy="262" r="4" fill="currentColor"/></g>' +
    '<g class="gf-orbit__ring gf-orbit__ring--c"><ellipse cx="200" cy="200" rx="90" ry="170"/><circle cx="200" cy="30" r="6" fill="currentColor"/></g>' +
  '</svg>';

  // 예시 데이터에서 id 로 게임 찾기
  function findGame(id) {
    var d = GF.mockData || {};
    var lists = [d.popular, d.latest, d.sale];
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i] || [];
      for (var j = 0; j < list.length; j++) if (list[j].id === id) return list[j];
    }
    return null;
  }

  function createAiIntro(root) {
    var esc = GF.utils.escapeHtml;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var selected = -1;
    var timer = null;
    var seq = 0;

    var chips = DEMOS.map(function (d, i) {
      return '<button type="button" class="gf-ai__chip" data-i="' + i + '" aria-pressed="false">' + esc(d.label) + '</button>';
    }).join('');
    var steps = STEPS.map(function (s) {
      return '<li class="gf-ai__step"><span class="gf-ai__step-no">' + s[0] + '</span>' +
        '<strong>' + esc(s[1]) + '</strong><span>' + esc(s[2]) + '</span></li>';
    }).join('');
    var floating = FLOATING.map(function (t, i) {
      return '<span class="gf-ai__float gf-ai__float--' + (i + 1) + '">' + esc(t) + '</span>';
    }).join('');

    // root 자체가 index.html 의 <section id="ai" class="gf-ai"> 이므로 내용만 채움
    root.innerHTML =
      '<div class="gf-ai__glow gf-ai__glow--blue" aria-hidden="true"></div>' +
      '<div class="gf-ai__glow gf-ai__glow--violet" aria-hidden="true"></div>' +
      '<div class="container gf-ai__inner">' +
        '<div class="gf-ai__text">' +
          '<p class="gf-ai__eyebrow"><span>04</span>AI DISCOVERY</p>' +
          '<h2 class="gf-ai__title" id="gf-ai-title">좋아하는 게임만 알려주세요.<br><em>취향에 맞는 게임</em> 5개를 골라드려요.</h2>' +
          '<p class="gf-ai__desc">AI가 취향을 분석해 GameFinder에 있는 게임 중에서만 추천합니다. 없는 게임을 지어내지 않고, 왜 추천하는지도 함께 보여드려요.</p>' +
          '<a class="gf-ai__cta" href="' + GF.routes.hrefOf('ai') + '">AI 추천 시작하기' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
          '</a>' +
          '<div class="gf-ai__demo">' +
            '<p class="gf-ai__demo-label" id="gf-ai-demo-label">이런 취향이라면? 눌러서 추천 예시를 확인해보세요 <span class="gf-ai__demo-badge">예시 미리보기</span></p>' +
            '<div class="gf-ai__chips" role="group" aria-labelledby="gf-ai-demo-label">' + chips + '</div>' +
            '<div class="gf-ai__result" aria-live="polite"></div>' +
            '<p class="gf-ai__demo-note">실제 AI 분석이 아닌 미리보기 예시입니다. 실제 추천은 AI 추천에서 취향에 맞춰 제공됩니다.</p>' +
          '</div>' +
        '</div>' +
        '<div class="gf-ai__visual" aria-hidden="true">' +
          '<div class="gf-ai__core"></div>' + ORBIT + floating +
        '</div>' +
        '<ol class="gf-ai__steps" aria-label="AI 추천 진행 단계">' + steps + '</ol>' +
      '</div>';

    var chipEls = Array.prototype.slice.call(root.querySelectorAll('.gf-ai__chip'));
    var result = root.querySelector('.gf-ai__result');
    var chipBox = root.querySelector('.gf-ai__chips');

    function picksHtml(demo) {
      var items = demo.picks.map(function (p, i) {
        var g = findGame(p[0]);
        if (!g) return '';
        return '<li class="gf-ai__pick" style="--i:' + i + '">' +
          '<a class="gf-ai__pick-link" href="' + GF.routes.gameHref(g.id) + '">' +
            '<span class="gf-ai__pick-img"><span class="gf-ai__pick-mono" aria-hidden="true">' + esc(String(g.title).charAt(0)) + '</span>' +
              (g.coverImage ? '<img src="' + esc(g.coverImage) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
            '</span>' +
            '<span class="gf-ai__pick-body"><strong>' + esc(g.title) + '</strong>' +
              '<span class="gf-ai__pick-why">' + esc(p[1]) + '</span></span>' +
          '</a></li>';
      }).join('');
      return '<ol class="gf-ai__picks" aria-label="' + esc(demo.label) + ' 추천 예시">' + items + '</ol>';
    }

    function show(i) {
      var my = ++seq;
      clearTimeout(timer);
      selected = i;
      chipEls.forEach(function (c, k) { c.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });

      if (i < 0) {
        root.classList.remove('is-thinking');
        result.innerHTML = '';
        return;
      }
      var wait = reduceMotion.matches ? 0 : THINK_MS;
      if (wait) {
        root.classList.add('is-thinking');
        result.innerHTML = '<p class="gf-ai__thinking">취향을 분석하는 중<span aria-hidden="true">…</span></p>';
      }
      timer = setTimeout(function () {
        if (my !== seq) return;
        root.classList.remove('is-thinking');
        result.innerHTML = picksHtml(DEMOS[i]);
      }, wait);
    }

    // 같은 칩을 다시 누르면 선택 해제
    function onChipClick(e) {
      var btn = e.target.closest('.gf-ai__chip');
      if (!btn) return;
      var i = Number(btn.dataset.i);
      show(i === selected ? -1 : i);
    }

    // 이미지 실패 시 머리글자 폴백만 남김 (error 는 버블링되지 않으므로 capture)
    function onImgError(e) {
      if (e.target.tagName === 'IMG' && e.target.closest('.gf-ai__pick-img')) e.target.remove();
    }

    chipBox.addEventListener('click', onChipClick);
    root.addEventListener('error', onImgError, true);

    // 처음부터 빈 화면이 아니도록 첫 번째 예시를 바로 보여줌 (분석 연출 없이)
    selected = 0;
    chipEls[0].setAttribute('aria-pressed', 'true');
    result.innerHTML = picksHtml(DEMOS[0]);

    return {
      destroy: function () {
        seq++;
        clearTimeout(timer);
        chipBox.removeEventListener('click', onChipClick);
        root.removeEventListener('error', onImgError, true);
        root.classList.remove('is-thinking');
        root.innerHTML = '';
      }
    };
  }

  GF.createAiIntro = createAiIntro;
})(window.GameFinder = window.GameFinder || {});
