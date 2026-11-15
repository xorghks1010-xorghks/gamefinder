/*
 * 게임 상세 페이지 — #/game/<id> 경로에서 메인 화면 대신 보여줍니다.
 *   const detail = GameFinder.createGameDetail(rootEl);   // rootEl = <main id="detail">
 *   detail.show(id);   // 데이터를 불러와 그림. 로딩 → 성공 | 없음(notfound) | 오류(다시 시도)
 *   detail.hide();     // 화면 비우기 (메인으로 돌아갈 때)
 *   detail.destroy();
 *
 * 구성: 상단 배너(제목·장르·평가·이동 버튼) / 본문(스토어 정보 · 소개 · 스크린샷 · 시스템 요구사항) / 사이드(게임 정보 · 가격 비교)
 * 데이터는 js/services/game-service.js 의 getGameDetail() 이 주며, 없는 항목은 그 섹션을 그냥 숨깁니다.
 * (Steam 유료 게임은 소개·스크린샷 API 가 브라우저에서 막혀 있어 Steam 공식 스토어 위젯(iframe)으로 대신 보여줍니다.)
 */
(function (GF) {
  'use strict';

  var esc = GF.utils.escapeHtml;
  var fmt = GF.utils;
  var BASE_TITLE = 'GameFinder';

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  var EXTERNAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z"/></svg>';

  function createGameDetail(root) {
    var seq = 0;
    var currentId = null;

    function backLink() {
      return '<a class="gf-dhero__back" href="' + GF.routes.hrefOf('home') + '">' + ARROW + '목록으로</a>';
    }

    // ---------- 상태 화면 ----------
    function showLoading() {
      root.setAttribute('aria-busy', 'true');
      root.innerHTML =
        '<div class="gf-dhero gf-dhero--plain"><div class="container gf-dhero__inner">' + backLink() +
          '<div class="gf-dskel gf-dskel--title"></div><div class="gf-dskel gf-dskel--line"></div></div></div>' +
        '<div class="container gf-dbody"><div class="gf-dmain"><div class="gf-dskel gf-dskel--block"></div></div>' +
        '<aside class="gf-dside"><div class="gf-dskel gf-dskel--block"></div></aside></div>';
    }

    function showMessage(title, text, retry) {
      root.removeAttribute('aria-busy');
      document.title = title + ' — ' + BASE_TITLE;
      root.innerHTML =
        '<div class="gf-dhero gf-dhero--plain"><div class="container gf-dhero__inner">' + backLink() +
          '<h1 class="gf-dhero__title" tabindex="-1">' + esc(title) + '</h1>' +
          '<p class="gf-dhero__desc">' + esc(text) + '</p>' +
          (retry ? '<button type="button" class="gf-state__retry gf-dretry">다시 시도</button>' : '') +
        '</div></div>';
      focusTitle();
    }

    function focusTitle() {
      var h = root.querySelector('.gf-dhero__title');
      if (h) h.focus({ preventScroll: true });
    }

    // ---------- 조각 ----------
    function chip(text) { return '<li class="gf-dhero__chip">' + esc(text) + '</li>'; }

    function ratingHtml(r) {
      if (!r) return '';
      var parts = [];
      if (r.steamPercent) {
        parts.push('<span class="gf-dscore"><span class="gf-dscore__star">' + STAR + '</span>Steam 긍정 <b>' + r.steamPercent + '%</b>' +
          (r.steamCount ? ' <small>(' + r.steamCount.toLocaleString('ko-KR') + '개 리뷰)</small>' : '') + '</span>');
      }
      if (r.metacritic) parts.push('<span class="gf-dscore">Metacritic <b>' + r.metacritic + '</b></span>');
      return parts.length ? '<p class="gf-dhero__scores">' + parts.join('') + '</p>' : '';
    }

    function section(title, body, id) {
      return '<section class="gf-dsec"' + (id ? ' aria-labelledby="' + id + '"' : '') + '><h2 class="gf-dsec__title"' + (id ? ' id="' + id + '"' : '') + '>' + esc(title) + '</h2>' + body + '</section>';
    }

    function paragraphs(text) {
      return text.split(/\r?\n+/).filter(function (p) { return p.trim(); })
        .map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
    }

    function dlRow(label, value) {
      return value ? '<div class="gf-dinfo__row"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>' : '';
    }

    function infoHtml(g) {
      var platforms = (g.platforms || []).map(GF.gameService.platformShortName).join(', ');
      var rows =
        dlRow('개발사', esc(g.developer)) +
        dlRow('퍼블리셔', esc(g.publisher)) +
        dlRow('출시일', g.releaseDate ? esc(fmt.formatDate(g.releaseDate)) : '') +
        dlRow('장르', esc((g.genres || []).join(', '))) +
        dlRow('플랫폼', esc(platforms)) +
        dlRow('가격', g.free ? '무료 플레이' : '');
      return rows ? section('게임 정보', '<dl class="gf-dinfo">' + rows + '</dl>', 'gf-d-info') : '';
    }

    function priceHtml(g) {
      if (!g.deals.length) {
        return g.free ? '' : section('가격 비교', '<p class="gf-dmuted">가격 정보가 없습니다.</p>', 'gf-d-price');
      }
      var best = g.deals[0].price;
      var rows = g.deals.map(function (d) {
        var cur = d.currency || 'USD';
        var action = d.url
          ? '<a class="gf-dbuy" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(d.store) + '에서 보기 (새 창)">보기' + EXTERNAL + '</a>'
          : '';
        return '<tr' + (d.price === best ? ' class="is-best"' : '') + '>' +
          '<th scope="row">' + esc(d.store) + (d.price === best && g.deals.length > 1 ? ' <em>최저가</em>' : '') + '</th>' +
          '<td>' + (d.savings > 0 ? '<s>' + fmt.formatPrice(d.retail, cur) + '</s>' : '') + '</td>' +
          '<td class="gf-dprice__now">' + fmt.formatPrice(d.price, cur) + (d.savings > 0 ? ' <small>-' + d.savings + '%</small>' : '') + '</td>' +
          '<td>' + action + '</td></tr>';
      }).join('');
      var ever = g.cheapestEver && g.cheapestEver.price
        ? '<p class="gf-dmuted">역대 최저가 ' + fmt.formatPrice(g.cheapestEver.price, 'USD') + (g.cheapestEver.date ? ' (' + fmt.formatDate(g.cheapestEver.date) + ')' : '') + '</p>' : '';
      var note = g.mock ? '' : '<p class="gf-dmuted">가격은 USD 기준이며 조회 시점에 따라 달라질 수 있습니다.</p>';
      return section('가격 비교',
        '<div class="gf-dtable-wrap"><table class="gf-dtable"><thead><tr><th scope="col">스토어</th><th scope="col">정가</th><th scope="col">현재가</th><th scope="col"><span class="sr-only">이동</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' + ever + note,
        'gf-d-price');
    }

    function mainHtml(g) {
      var out = '';
      if (g.steamAppId) {
        out += section('스토어 정보',
          '<iframe class="gf-dwidget" src="https://store.steampowered.com/widget/' + esc(g.steamAppId) + '/?l=koreana" title="' + esc(g.title) + ' Steam 스토어 위젯" loading="lazy" height="190"></iframe>' +
          '<p class="gf-dmuted">Steam 공식 스토어 위젯입니다. 설명과 구매 정보는 Steam에서 제공합니다.</p>', 'gf-d-store');
      }
      if (g.description) out += section('소개', '<div class="gf-dtext">' + paragraphs(g.description) + '</div><p class="gf-dmuted">소개 글은 FreeToGame이 제공하는 영문 설명입니다.</p>', 'gf-d-about');
      if (g.screenshots.length) {
        out += section('스크린샷', '<ul class="gf-dshots">' + g.screenshots.map(function (u, i) {
          return '<li><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(g.title) + ' 스크린샷 ' + (i + 1) + ' 크게 보기 (새 창)">' +
            '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a></li>';
        }).join('') + '</ul>', 'gf-d-shots');
      }
      if (g.requirements.length) {
        out += section('최소 시스템 요구사항', '<dl class="gf-dinfo">' + g.requirements.map(function (r) { return dlRow(r[0], esc(r[1])); }).join('') + '</dl>', 'gf-d-req');
      }
      if (!out) out = '<p class="gf-dmuted">이 게임의 추가 설명은 아직 준비되지 않았습니다.</p>';
      return out;
    }

    function render(g) {
      root.removeAttribute('aria-busy');
      document.title = g.title + ' — ' + BASE_TITLE;

      var bg = g.heroImage || g.headerImage;
      var bgImg = bg ? '<img class="gf-dhero__img' + (g.heroImage ? '' : ' is-blur') + '" src="' + esc(bg) + '" alt="" decoding="async" referrerpolicy="no-referrer">' : '';
      var kicker = [g.source === '예시 데이터' ? '예시 데이터' : g.source, g.origin === 'KR' ? '국내 게임' : ''].filter(Boolean).join(' · ');
      var chips = (g.genres || []).map(chip).join('') + chip('PC') + (g.releaseDate ? chip(fmt.formatDate(g.releaseDate)) : '');
      var ctas = '';
      if (g.steamAppId) ctas += '<a class="gf-dcta gf-dcta--main" href="https://store.steampowered.com/app/' + esc(g.steamAppId) + '" target="_blank" rel="noopener noreferrer">Steam에서 보기' + EXTERNAL + '</a>';
      if (g.officialUrl) ctas += '<a class="gf-dcta' + (g.steamAppId ? '' : ' gf-dcta--main') + '" href="' + esc(g.officialUrl) + '" target="_blank" rel="noopener noreferrer">' + (g.free ? '무료로 플레이하기' : '공식 사이트') + EXTERNAL + '</a>';

      root.innerHTML =
        '<article>' +
          '<header class="gf-dhero">' +
            '<div class="gf-dhero__bg">' + bgImg + '</div>' +
            '<div class="container gf-dhero__inner">' +
              backLink() +
              '<p class="gf-dhero__kicker">' + esc(kicker) + '</p>' +
              '<h1 class="gf-dhero__title" tabindex="-1">' + esc(g.title) + '</h1>' +
              '<ul class="gf-dhero__chips" aria-label="게임 요약">' + chips + '</ul>' +
              ratingHtml(g.rating) +
              (ctas ? '<div class="gf-dhero__cta">' + ctas + '</div>' : '') +
            '</div>' +
          '</header>' +
          '<div class="container gf-dbody">' +
            '<div class="gf-dmain">' + mainHtml(g) + '</div>' +
            '<aside class="gf-dside" aria-label="게임 정보와 가격">' + infoHtml(g) + priceHtml(g) + '</aside>' +
          '</div>' +
          '<div class="container"><p class="gf-dsource">' + (g.mock ? '개발 단계의 예시 데이터입니다.' : '데이터: CheapShark · Steam · FreeToGame (저작권은 각 게임 권리자에게 있습니다)') + '</p></div>' +
        '</article>';
      focusTitle();
    }

    // ---------- 불러오기 ----------
    function load(id) {
      var my = ++seq;
      currentId = id;
      showLoading();
      GF.gameService.getGameDetail(id).then(function (g) {
        if (my !== seq) return;
        render(g);
      }).catch(function (err) {
        if (my !== seq) return;
        if (err && err.code === 'notfound') showMessage('찾을 수 없는 게임입니다', '주소가 잘못되었거나 더 이상 제공되지 않는 게임입니다.', false);
        else showMessage('게임 정보를 불러오지 못했습니다', '네트워크 상태를 확인한 뒤 다시 시도해 주세요.', true);
      });
    }

    function onClick(e) {
      if (e.target.closest('.gf-dretry') && currentId) load(currentId);
    }

    // 이미지 실패 시 배경/스크린샷 이미지만 제거
    function onImgError(e) {
      var t = e.target;
      if (t.tagName === 'IMG' && (t.classList.contains('gf-dhero__img') || t.closest('.gf-dshots'))) {
        var li = t.closest('li');
        if (li) li.remove(); else t.remove();
      }
    }

    root.addEventListener('click', onClick);
    root.addEventListener('error', onImgError, true);

    return {
      show: function (id) { load(id); },
      hide: function () { seq++; currentId = null; root.innerHTML = ''; root.removeAttribute('aria-busy'); document.title = BASE_TITLE; },
      destroy: function () {
        seq++;
        root.removeEventListener('click', onClick);
        root.removeEventListener('error', onImgError, true);
        root.innerHTML = '';
      }
    };
  }

  GF.createGameDetail = createGameDetail;
})(window.GameFinder = window.GameFinder || {});
