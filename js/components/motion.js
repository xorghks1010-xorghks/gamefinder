/*
 * 모션 효과 모음 — 기능은 건드리지 않고 "느낌"만 더하는 인터랙션입니다.
 *   const m = GameFinder.createMotion(heroEl);  m.destroy();
 *     1) Hero 시차(parallax) + 커서 따라다니는 빛   (마우스 전용)
 *     2) 게임 카드 틸트 + 빛 반사                    (마우스 전용, rank / latest / feature 카드)
 *   GameFinder.motion.countUp(elements)  — 화면에 들어오면 "-50%" 같은 숫자를 0부터 올려서 보여줌
 * 터치 기기이거나 prefers-reduced-motion 이면 아무 효과도 내지 않고 최종 값을 그대로 보여줍니다.
 */
(function (GF) {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function canMove() { return finePointer.matches && !reduceMotion.matches; }

  var TILT_SELECTOR = '.gf-card--rank, .gf-card--latest, .gf-card--feature';
  var TILT_MAX = { rank: 5, latest: 7, feature: 4 };   // 도(deg)

  function tiltKind(card) {
    return card.classList.contains('gf-card--feature') ? 'feature'
      : card.classList.contains('gf-card--latest') ? 'latest' : 'rank';
  }

  function createMotion(hero) {
    var raf = 0;
    var next = null;

    // ---------- 1) Hero 시차 ----------
    function applyHero() {
      raf = 0;
      if (!next) return;
      hero.style.setProperty('--px', next.px.toFixed(3));
      hero.style.setProperty('--py', next.py.toFixed(3));
      hero.style.setProperty('--mx', next.mx.toFixed(1) + '%');
      hero.style.setProperty('--my', next.my.toFixed(1) + '%');
    }

    function onHeroMove(e) {
      if (e.pointerType !== 'mouse' || !canMove() || hero.classList.contains('is-dragging')) return;
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      next = { px: (x - 0.5) * 2, py: (y - 0.5) * 2, mx: x * 100, my: y * 100 };
      hero.classList.add('is-hovering');
      if (!raf) raf = requestAnimationFrame(applyHero);
    }

    function onHeroLeave() {
      hero.classList.remove('is-hovering');
      next = { px: 0, py: 0, mx: 70, my: 40 };
      if (!raf) raf = requestAnimationFrame(applyHero);
    }

    hero.addEventListener('pointermove', onHeroMove);
    hero.addEventListener('pointerleave', onHeroLeave);

    // ---------- 2) 카드 틸트 (document 위임: 카드가 나중에 그려져도 동작) ----------
    var tilted = null;
    var cardRaf = 0;
    var cardPoint = null;

    function glareOf(card) {
      var host = card.classList.contains('gf-card--latest') ? card.querySelector('.gf-card__media') : card;
      if (!host) return null;
      var g = host.querySelector(':scope > .gf-card__glare');
      if (!g) {
        g = document.createElement('span');
        g.className = 'gf-card__glare';
        g.setAttribute('aria-hidden', 'true');
        host.appendChild(g);
      }
      return g;
    }

    function resetCard(card) {
      card.classList.remove('is-tilting');
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
      card.style.removeProperty('--gx');
      card.style.removeProperty('--gy');
    }

    function applyCard() {
      cardRaf = 0;
      if (!tilted || !cardPoint) return;
      var r = tilted.getBoundingClientRect();
      var x = Math.min(1, Math.max(0, (cardPoint.x - r.left) / r.width));
      var y = Math.min(1, Math.max(0, (cardPoint.y - r.top) / r.height));
      var max = TILT_MAX[tiltKind(tilted)];
      tilted.style.setProperty('--ry', ((x - 0.5) * 2 * max).toFixed(2) + 'deg');
      tilted.style.setProperty('--rx', ((0.5 - y) * 2 * max).toFixed(2) + 'deg');
      tilted.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      tilted.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    }

    function onDocMove(e) {
      if (e.pointerType !== 'mouse' || !canMove()) return;
      var card = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
      if (card !== tilted) {
        if (tilted) resetCard(tilted);
        tilted = card;
        if (card) { glareOf(card); card.classList.add('is-tilting'); }
      }
      if (!tilted) return;
      cardPoint = { x: e.clientX, y: e.clientY };
      if (!cardRaf) cardRaf = requestAnimationFrame(applyCard);
    }

    function onDocLeave() {
      if (tilted) { resetCard(tilted); tilted = null; }
    }

    document.addEventListener('pointermove', onDocMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onDocLeave);

    return {
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        if (cardRaf) cancelAnimationFrame(cardRaf);
        hero.removeEventListener('pointermove', onHeroMove);
        hero.removeEventListener('pointerleave', onHeroLeave);
        document.removeEventListener('pointermove', onDocMove);
        document.documentElement.removeEventListener('pointerleave', onDocLeave);
        if (tilted) resetCard(tilted);
        Array.prototype.forEach.call(document.querySelectorAll('.gf-card__glare'), function (g) { g.remove(); });
      }
    };
  }

  // ---------- 3) 숫자 카운트업 ----------
  // 요소의 텍스트(예: "-50%")에서 숫자만 0 → 목표값으로 올립니다. 스크린리더는 aria-label 을 읽으므로 영향 없음.
  var DURATION = 900;

  function countUp(elements) {
    Array.prototype.forEach.call(elements, function (el) {
      var text = el.textContent;
      var m = /(\d+)/.exec(text);
      if (!m) return;
      var target = parseInt(m[1], 10);
      var before = text.slice(0, m.index);
      var after = text.slice(m.index + m[1].length);

      if (!canMove() && reduceMotion.matches) return;   // 모션 줄이기: 최종값 그대로
      if (!('IntersectionObserver' in window)) return;

      el.textContent = before + '0' + after;
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var start = null;
        function tick(t) {
          if (start === null) start = t;
          var p = Math.min(1, (t - start) / DURATION);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = before + Math.round(target * eased) + after;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, { threshold: 0.6 });
      io.observe(el);
    });
  }

  GF.createMotion = createMotion;
  GF.motion = { countUp: countUp };
})(window.GameFinder = window.GameFinder || {});
