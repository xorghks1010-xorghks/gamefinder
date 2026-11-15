/*
 * Hero 슬라이드 데이터 — 문구·이미지·이동 경로는 여기서만 수정합니다.
 *  - routeId  : js/routes.js 의 라우트 id
 *  - image    : 배경 이미지 경로 (null이면 그라데이션 폴백 비주얼 사용, 로딩 실패 시에도 폴백)
 *  - icon     : 폴백 비주얼에 쓰는 아이콘 이름
 *  - deco     : 슬라이드 전용 장식 — 'orbit'(AI 궤도 일러스트) 또는 decoText(큰 외곽선 워드마크)
 *  슬라이드별 포인트 컬러는 hero.css 의 .gf-slide--{id} 에서 정의합니다.
 */
(function (GF) {
  'use strict';

  // 배경 이미지는 GameFinder 용으로 직접 만든 오리지널 SVG(assets/hero/) — 저작권 문제 없음
  GF.heroSlides = [
    {
      id: 'ai',
      eyebrow: 'AI 추천',
      title: '내 취향에 맞는 게임을 찾아보세요',
      description: '사용자의 게임 취향을 분석하여 어울리는 게임을 추천해 드립니다.',
      ctaLabel: 'AI 추천 시작하기',
      routeId: 'ai',
      image: 'assets/hero/ai.svg',
      imageAlt: '별자리처럼 연결된 보라색 네트워크와 빛나는 중심 구체',
      icon: 'sparkle',
      deco: 'orbit'
    },
    {
      id: 'sale',
      eyebrow: '할인 게임',
      title: '지금 할인 중인 게임을 확인하세요',
      description: 'Steam, Epic Games 등 게임 스토어의 할인 정보를 한곳에서 확인하세요.',
      ctaLabel: '할인 게임 보기',
      routeId: 'sale',
      image: 'assets/hero/sale.svg',
      imageAlt: '황금빛 할인 태그 일러스트',
      icon: 'tag',
      decoText: 'SALE'
    },
    {
      id: 'rank',
      eyebrow: '인기 순위',
      title: '요즘 가장 인기 있는 게임은?',
      description: '현재 인기 있는 게임의 순위를 확인하세요.',
      ctaLabel: '인기 순위 보기',
      routeId: 'rank',
      image: 'assets/hero/rank.svg',
      imageAlt: '별이 올라간 세 개의 순위 막대 일러스트',
      icon: 'trophy',
      decoText: 'TOP'
    }
  ];
})(window.GameFinder = window.GameFinder || {});
