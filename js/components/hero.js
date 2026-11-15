/*
 * Hero 슬라이드 컴포넌트
 *   const hero = GameFinder.createHero(rootEl, slides, { interval: 5000 });
 *   hero.goTo(1); hero.next(); hero.prev(); hero.destroy();
 *
 * 슬라이드는 "현재 기준 상대 위치(-1 / 0 / +1)"로 배치되어 마지막 → 첫 번째로도
 * 같은 방향으로 이어서 순환합니다. 마우스 드래그·터치 스와이프는 Pointer Events 하나로 처리합니다.
 */
(function (GF) {
  'use strict';

  var ICONS = {
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3Z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.500"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M10 18h4"/></svg>',
    // AI 슬라이드 전용 장식: 취향을 중심으로 후보가 궤도를 도는 추상 일러스트
    orbit: '<svg class="gf-orbit" viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">' +
      '<circle cx="200" cy="200" r="44" fill="currentColor" fill-opacity=".12"/>' +
      '<circle cx="200" cy="200" r="190" stroke-dasharray="2 9"/>' +
      '<g class="gf-orbit__ring gf-orbit__ring--a"><ellipse cx="200" cy="200" rx="170" ry="66"/><circle cx="370" cy="200" r="7" fill="currentColor"/></g>' +
      '<g class="gf-orbit__ring gf-orbit__ring--b"><ellipse cx="200" cy="200" rx="130" ry="130"/><circle cx="200" cy="70" r="5" fill="currentColor"/><circle cx="82" cy="262" r="4" fill="currentColor"/></g>' +
      '<g class="gf-orbit__ring gf-orbit__ring--c"><ellipse cx="200" cy="200" rx="90" ry="170"/><circle cx="200" cy="30" r="6" fill="currentColor"/></g>' +
      '<path d="M200 178l5 12 12 5-12 5-5 12-5-12-12-5 12-5 5-12Z" fill="currentColor" stroke="none"/>' +
    '</svg>'
  };

  var DRAG_START_PX = 6;      // 이 이상 움직여야 드래그로 판정
  var SWIPE_MIN_PX = 60;      // 슬라이드 전환 최소 거리
  var SWIPE_RATIO = 0.15;     // 또는 화면 너비 대비 비율 중 큰 값

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function createHero(root, slides, options) {
    var opts = options || {};
    var interval = opts.interval || 5000;
    var count = slides.length;
    var routes = GF.routes;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // ---------- 렌더 ----------
    var slidesHtml = slides.map(function (s, i) {
      var img = s.image
        ? '<img class="gf-slide__img" src="' + escapeHtml(s.image) + '" alt="' + escapeHtml(s.imageAlt || '') + '" draggable="false" decoding="async" fetchpriority="' + (i === 0 ? 'high' : 'low') + '">'
        : '';
      var deco = s.deco === 'orbit' ? ICONS.orbit
        : s.decoText ? '<span class="gf-slide__word">' + escapeHtml(s.decoText) + '</span>' : '';
      return (
        '<div class="gf-slide gf-slide--' + escapeHtml(s.id) + '" role="group" aria-roledescription="슬라이드" aria-label="' + (i + 1) + ' / ' + count + '">' +
          // 배경 비주얼(이미지 + 어두운 오버레이). 이미지가 없거나 실패해도 그라데이션 폴백이 남음
          '<div class="gf-slide__visual">' +
            '<div class="gf-slide__fallback">' + (ICONS[s.icon] || '') + '</div>' +
            img +
          '</div>' +
          '<div class="gf-slide__deco" aria-hidden="true">' + deco + '</div>' +
          '<div class="container gf-slide__inner">' +
            '<div class="gf-slide__text">' +
              '<p class="gf-slide__eyebrow"><span class="gf-slide__idx">0' + (i + 1) + '</span>' + escapeHtml(s.eyebrow) + '</p>' +
              '<h2 class="gf-slide__title">' + escapeHtml(s.title) + '</h2>' +
              '<p class="gf-slide__desc">' + escapeHtml(s.description) + '</p>' +
              '<a class="gf-slide__cta" href="' + routes.hrefOf(s.routeId) + '" draggable="false">' +
                escapeHtml(s.ctaLabel) + ICONS.arrow +
              '</a>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var dotsHtml = slides.map(function (s, i) {
      return '<button type="button" class="gf-hero__dot" aria-label="' + (i + 1) + '번째 슬라이드로 이동: ' + escapeHtml(s.eyebrow) + '"></button>';
    }).join('');

    // root 자체가 index.html 의 <section id="hero" class="gf-hero"> 이므로 내용만 채움
    root.innerHTML =
      '<div class="gf-hero__viewport">' + slidesHtml + '</div>' +
      '<button type="button" class="gf-hero__arrow gf-hero__arrow--prev" aria-label="이전 슬라이드">' + ICONS.prev + '</button>' +
      '<button type="button" class="gf-hero__arrow gf-hero__arrow--next" aria-label="다음 슬라이드">' + ICONS.next + '</button>' +
      '<div class="gf-hero__dots"><div class="container gf-hero__dots-inner">' + dotsHtml +
        '<span class="gf-hero__count" aria-hidden="true"></span></div></div>';

    var section = root;
    section.style.setProperty('--gf-interval', interval + 'ms');
    var countEl = root.querySelector('.gf-hero__count');
    var viewport = root.querySelector('.gf-hero__viewport');
    var slideEls = Array.prototype.slice.call(root.querySelectorAll('.gf-slide'));
    var dotEls = Array.prototype.slice.call(root.querySelectorAll('.gf-hero__dot'));
    var prevBtn = root.querySelector('.gf-hero__arrow--prev');
    var nextBtn = root.querySelector('.gf-hero__arrow--next');

    // 이미지 로딩 실패 시 폴백 비주얼만 남김
    Array.prototype.forEach.call(root.querySelectorAll('.gf-slide__img'), function (img) {
      img.addEventListener('error', function () { img.remove(); });
    });

    // ---------- 상태 ----------
    var index = 0;
    var dragX = 0;
    var dragging = false;
    var pressed = false;
    var startX = 0;
    var startY = 0;
    var activePointer = null;
    var suppressClick = false;
    var hovering = false;
    var focusing = false;
    var timer = null;
    var lastPos = slideEls.map(function (_, i) { return relPos(i); });

    function mod(n) { return ((n % count) + count) % count; }

    // 현재 index 기준 상대 위치: -1(이전) / 0(현재) / +1(다음)
    function relPos(i) {
      var d = mod(i - index);
      return d > count / 2 ? d - count : d;
    }

    function clampPos(p) { return Math.max(-1, Math.min(1, p)); }

    function render() {
      slideEls.forEach(function (el, i) {
        var pos = relPos(i);
        var jumped = Math.abs(pos - lastPos[i]) > 1;
        var hidden = Math.abs(pos) > 1;
        el.style.visibility = hidden ? 'hidden' : '';

        if (jumped) {
          // 화면을 가로질러 되돌아가는 슬라이드는 애니메이션 없이 반대편으로 이동
          el.style.transition = 'none';
          el.style.transform = 'translateX(calc(' + clampPos(pos) * 100 + '% + ' + dragX + 'px))';
          void el.offsetWidth;
          el.style.transition = '';
        } else {
          el.style.transform = 'translateX(calc(' + pos * 100 + '% + ' + dragX + 'px))';
        }
        lastPos[i] = pos;

        var current = pos === 0;
        el.inert = !current;
        el.classList.toggle('is-active', current);   // 활성 슬라이드만 텍스트 등장·이미지 줌 연출
        el.setAttribute('aria-hidden', current ? 'false' : 'true');
      });
      countEl.textContent = '0' + (index + 1) + ' / 0' + count;
      dotEls.forEach(function (d, i) {
        if (i === index) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    // ---------- 자동 전환 ----------
    function canAutoplay() {
      return count > 1 && !hovering && !focusing && !pressed && !dragging &&
             !document.hidden && !reduceMotion.matches;
    }

    // 상태가 바뀔 때마다 타이머를 다시 잡아 사용자 조작과 충돌하지 않게 함
    function schedule() {
      clearTimeout(timer);
      timer = null;
      var playing = canAutoplay();
      viewport.setAttribute('aria-live', playing ? 'off' : 'polite');
      // 진행 바: 타이머가 새로 시작될 때마다 CSS 애니메이션도 처음부터 다시 시작
      section.classList.remove('is-playing');
      if (!playing) return;
      void section.offsetWidth;
      section.classList.add('is-playing');
      timer = setTimeout(function () { goTo(index + 1); }, interval);
    }

    function goTo(i) {
      index = mod(i);
      dragX = 0;
      render();
      schedule();
    }

    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    // ---------- 버튼 / 인디케이터 / 키보드 ----------
    function onPrev() { prev(); }
    function onNext() { next(); }
    var dotHandlers = dotEls.map(function (_, i) { return function () { goTo(i); }; });

    function onKeydown(e) {
      if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
    }

    // ---------- 호버 / 포커스 일시정지 ----------
    function onEnter(e) { if (e.pointerType === 'mouse') { hovering = true; schedule(); } }
    function onLeave(e) { if (e.pointerType === 'mouse') { hovering = false; schedule(); } }
    function onFocusIn(e) {
      // 마우스 클릭으로 생긴 포커스는 제외하고 키보드 포커스일 때만 정지
      if (e.target.matches && e.target.matches(':focus-visible')) { focusing = true; schedule(); }
    }
    function onFocusOut(e) {
      if (!section.contains(e.relatedTarget)) { focusing = false; schedule(); }
    }
    function onVisibility() { schedule(); }
    function onMotionChange() { schedule(); }

    // ---------- 드래그 / 스와이프 ----------
    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pressed) return;
      pressed = true;
      dragging = false;
      activePointer = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      schedule();
    }

    function onPointerMove(e) {
      if (!pressed || e.pointerId !== activePointer) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true;
        section.classList.add('is-dragging');
        try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
      dragX = dx;
      render();
    }

    function endPointer(e, cancelled) {
      if (!pressed || e.pointerId !== activePointer) return;
      var dx = e.clientX - startX;
      var wasDragging = dragging;
      pressed = false;
      dragging = false;
      activePointer = null;
      section.classList.remove('is-dragging');
      try { viewport.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }

      if (wasDragging) {
        // 드래그 직후 발생하는 click(CTA 이동)을 막음
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 0);

        var threshold = Math.max(SWIPE_MIN_PX, viewport.clientWidth * SWIPE_RATIO);
        if (!cancelled && dx <= -threshold) { next(); return; }
        if (!cancelled && dx >= threshold) { prev(); return; }
        dragX = 0;       // 짧은 드래그: 현재 슬라이드로 복귀
        render();
      }
      schedule();
    }

    function onPointerUp(e) { endPointer(e, false); }
    function onPointerCancel(e) { endPointer(e, true); }

    function onClickCapture(e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
    }

    function onDragStart(e) { e.preventDefault(); }   // 링크·이미지 기본 드래그 방지

    // ---------- 이벤트 등록 / 정리 ----------
    var bindings = [
      [prevBtn, 'click', onPrev],
      [nextBtn, 'click', onNext],
      [section, 'keydown', onKeydown],
      [section, 'pointerenter', onEnter],
      [section, 'pointerleave', onLeave],
      [section, 'focusin', onFocusIn],
      [section, 'focusout', onFocusOut],
      [viewport, 'pointerdown', onPointerDown],
      [viewport, 'pointermove', onPointerMove],
      [viewport, 'pointerup', onPointerUp],
      [viewport, 'pointercancel', onPointerCancel],
      [viewport, 'click', onClickCapture, true],
      [viewport, 'dragstart', onDragStart],
      [document, 'visibilitychange', onVisibility],
      [reduceMotion, 'change', onMotionChange]
    ];
    dotEls.forEach(function (d, i) { bindings.push([d, 'click', dotHandlers[i]]); });
    bindings.forEach(function (b) { b[0].addEventListener(b[1], b[2], b[3]); });

    if (count < 2) {
      prevBtn.hidden = true;
      nextBtn.hidden = true;
      root.querySelector('.gf-hero__dots').hidden = true;
    }

    render();
    schedule();

    return {
      goTo: goTo,
      next: next,
      prev: prev,
      destroy: function () {
        clearTimeout(timer);
        bindings.forEach(function (b) { b[0].removeEventListener(b[1], b[2], b[3]); });
        root.innerHTML = '';
      }
    };
  }

  GF.createHero = createHero;
})(window.GameFinder = window.GameFinder || {});
