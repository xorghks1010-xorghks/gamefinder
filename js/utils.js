(function (GF) {
  'use strict';

  var priceFormat = new Intl.NumberFormat('ko-KR');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 12000 → '₩12,000' (KRW, 기본) / formatPrice(7.49, 'USD') → '$7.49' */
  function formatPrice(n, currency) {
    if (typeof n !== 'number' || isNaN(n)) return '가격 정보 없음';
    return currency === 'USD' ? '$' + n.toFixed(2) : '₩' + priceFormat.format(n);
  }

  /** '2025-09-04' → '2025.09.04' */
  function formatDate(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.replace(/-/g, '.') : '출시일 미정';
  }

  GF.utils = { escapeHtml: escapeHtml, formatPrice: formatPrice, formatDate: formatDate };
})(window.GameFinder = window.GameFinder || {});
