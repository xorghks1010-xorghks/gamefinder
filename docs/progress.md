# GameFinder 진행 기록

> 다음 작업을 시작할 때 이 파일을 먼저 읽고, 작업이 끝나면 맨 아래 "작업 로그"에 추가한 뒤 "다음에 할 일"을 갱신합니다.
> 기준 문서: `plan.md` (기획서, 04장 = 디자인 개선 계획) / `gamefinder-project-plan.html` (기획서 HTML)
> 코드 위치: `gamefinder/` (정적 사이트, 빌드 없음 — `index.html`을 브라우저로 열면 동작)

## 현재 상태 (2026-11-15 기준)

메인 화면(SCR-001)의 디자인 개선 1~5차는 **코드상 구현 완료**, 6차(전체 점검)는 **일부 완료**.

| 차수 | 내용 | 상태 | 관련 파일 |
|---|---|---|---|
| 1차 | Hero (3슬라이드, 오버레이, CTA, 자동재생·드래그·키보드) | 완료 | `js/components/hero.js`, `css/hero.css`, `data/hero-slides.js` |
| 2차 | 인기 TOP 5 (1위 강조 비대칭 그리드) | 완료 | `game-section.js`(layout:rank), `sections.css`, `game-card.css` |
| 3차 | AI 소개 섹션 (다크 + 블루·퍼플, 궤도 비주얼) | 완료 | `ai-intro.js`, `ai-intro.css` |
| 4차 | 게임 카드 공통화 (rank/latest/feature/row/default, 스켈레톤, 이미지 폴백) | 완료 | `game-card.js`, `game-card.css` |
| 5차 | 장르·플랫폼 탐색 (이미지 타일 + 칩) | 완료 | `explore.js`, `sections.css` |
| 7차 | **임팩트 모션 추가** (Hero 시차·커서 빛, 카드 틸트·빛 반사, 카드 순차 등장, 할인율 카운트업) | 완료 | `js/components/motion.js`, `css/motion.css` |
| 8차 | **AI 섹션 인터랙티브 데모** (취향 칩 클릭 → 예시 추천 3개 + 이유) | 완료 | `ai-intro.js`, `ai-intro.css` |
| 9차 | **전체 다크 톤 변경** (섹션 `#0a1222`↔`#0e1a35` 교차, 면 `#111f3f`) | 완료 | `css/base.css`(색 토큰), `sections.css`, `game-card.css` |
| 6차 | 전체 점검 (모바일 / 키보드 접근성 / 성능 / 오류 상태) | **일부 완료** | 아래 "6차 점검 결과" 참고 |

## 7차: 임팩트 모션 (포트폴리오용으로 단조로워 보여서 추가)

- **Hero**: 마우스 움직임에 배경 이미지·장식(궤도/SALE·TOP 글자)·텍스트가 서로 다른 속도로 움직이는 시차 + 커서를 따라다니는 은은한 빛
- **카드**: 인기/최신/대표할인 카드가 마우스 위치에 따라 기울어지고(최대 4~7도) 빛이 반사됨. 가로형 할인 카드는 제외
- **스크롤**: 섹션이 보이면 카드가 90ms 간격으로 순서대로 올라오며 등장
- **숫자**: 대표 할인 카드의 `-50%`가 0부터 올라감 (0.9초)
- 마우스 전용(`hover:hover` + `pointer:fine`)이고 `prefers-reduced-motion` 이면 모두 꺼짐 → 터치 기기·모션 줄이기에서는 기존 화면 그대로
- 검증: Chrome 원격제어로 실제 마우스 이동 → `--px`, 틸트 `--rx/--ry`, 카운트업(-33% → -50%) 값 확인, 1440px/390px 레이아웃 확인

## 9차: 전체 다크 톤

- `base.css` 색 토큰을 다크로 교체: `--bg #0a1222`, `--bg-alt #0e1a35`(교차 섹션), `--bg-soft #111f3f`(카드·타일·칩 면), `--text #e8edf7`, `--heading #f4f7fd`(새로 추가, 제목용), `--muted #9aa7c0`, `--line #26345a`, `color-scheme: dark`
- 주의: `--navy`는 이제 **배경용**(카드 media 배경, 알림, 할인 배지 등)으로만 쓰고, 제목 글자색은 `--heading`을 씀
- 개별 수정: 가로형 할인 카드(흰 → `--bg-soft`), 탐색 타일·장르 칩·호버(네이비 → 블루), 알림(`.gf-notice`), 할인 섹션 점 패턴(흰색 점), Epic Games 점 색, 섹션 라벨(`--blue` 3.96:1 → `--blue-soft` 9.5:1)
- 검증: 데스크톱 1440px 전체 / 모바일 390px 캡처 확인, 대비 계산(보조 글자 6.7:1 이상)
- 안 건드림: Hero, AI 섹션, 헤더, 푸터(원래 다크). 백업 `gamefinder-backup-2026-11-15/`는 **다크 톤 변경 직전**(모션·AI 데모 포함) 버전이라 되돌리고 싶으면 이걸로 복원
- 후속 확인 완료(2026-11-15): 오류(`?mock=error`)·빈(`?mock=empty`) 상태 화면, 실제 CheapShark 데이터 화면 모두 다크 톤에서 정상. 오류 화면 '다시 시도' 버튼 글자는 `--blue-soft`로, 일반 카드 호버 제목색도 `--blue-soft`로 수정. 포커스 링도 `--blue-soft`. (실제 키보드 이동은 아직 수동 확인 전)
- 성능(일부): `index.html`에 preconnect(jsdelivr·steam CDN·cheapshark) + 첫 Hero 이미지 preload 추가, `hero.js` 첫 슬라이드 이미지 `fetchpriority=high`(나머지 low)·`decoding=async`. **preload 주소는 `data/hero-slides.js` 첫 슬라이드와 같아야 함** (바꾸면 같이 수정). Lighthouse 실측은 아직 안 함

## 8차: AI 섹션 인터랙티브 데모

- 취향 문구 3개(`스토리가 탄탄한 RPG` / `혼자 즐기는 힐링 게임` / `친구와 함께하는 협동 액션`)를 `<button aria-pressed>`로 변경. 누르면 0.65초 "취향을 분석하는 중…" 후 예시 추천 3개(커버·제목·추천 이유) 표시, 같은 칩을 다시 누르면 해제. 처음엔 첫 번째 칩이 선택된 상태
- **실제 AI 호출 아님**: 칩별 게임 3개와 이유는 `ai-intro.js`의 `DEMOS`에 하드코딩, 게임 정보는 `data/mock/games.js`에서 id로 조회. 화면에 "예시 미리보기" 배지 + 안내 문구 표시. 적합도 점수는 만들지 않음
- 선택 상태는 색뿐 아니라 ✓ 표시·굵기로도 구분, 결과 영역 `aria-live="polite"`, 모션 줄이기 시 분석 연출 생략
- 기획서 `plan.md` 04-3 AI 추천 소개 행의 "클릭 기능 추가하지 않음"을 위 내용으로 수정함
- 검증: Chrome 원격제어로 실제 클릭 → 선택/분석중/결과/해제 상태와 JS 오류 없음 확인, 1440px·390px 화면 확인
- 나중에 할 일: 실제 AI 추천 페이지(`#/ai`)를 만들면 이 데모의 문구·결과와 톤을 맞출 것. 추천 이유 문구는 직접 쓴 예시이니 필요하면 수정

## 6차 점검 결과

확인 완료 (OK)
- JS 전 파일 문법 검사 통과 (`node --check`)
- 데스크톱 1440px / 모바일 390px 화면 확인 — 레이아웃 깨짐 없음 (모바일 햄버거 메뉴, Hero 줄바꿈, 인기 1위 카드 정상)
- `prefers-reduced-motion` 처리: 모든 CSS 파일(footer 제외) + hero/section 스크립트에 있음
- `:focus-visible` 전역 + 컴포넌트별 있음, 건너뛰기 링크(skip-link), `aria-live`, `aria-current`, Hero `inert` 처리 있음
- Loading(스켈레톤) / Empty / Error(다시 시도) 상태 구현됨 — `?mock=slow | empty | error` 로 확인 가능
- 이미지 실패 시 대체 이미지 → 그라데이션 폴백 동작 구현됨

이번에 수정한 것
- `css/base.css`: `--muted` `#6b7280` → `#5b6472` (연한 파랑 배경 `#f4f7fc` 위 대비 4.50 → 5.57, 작은 글자 기준 안전하게)
- `js/services/game-service.js`: API 요청 10초 제한 시간(`AbortController`) 추가 → 응답이 없을 때 로딩이 끝나지 않고 "다시 시도" 오류 화면으로 전환

## 다음에 할 일 (우선순위 순)

1. **실제 브라우저 수동 점검** (자동으로 못 한 부분)
   - 키보드만으로 Tab 이동 순서 / Hero 좌우 방향키 / 모바일 메뉴 Esc 닫기
   - 실제 폰(또는 개발자도구 기기 모드)에서 Hero 스와이프, 최신 게임 가로 스크롤
   - 768px 전후 태블릿 폭 확인 (이번엔 1440 / 390만 봄)
2. **성능**: preload/preconnect는 적용함. 남은 것: Lighthouse 실측, 이미지가 Steam CDN 원본이라 큼 → 필요하면 썸네일 크기 조정
3. **이미지 라이선스**: `data/hero-slides.js`의 Steam 아트워크는 개발용 임시. 배포 전 사용 조건 확인/교체 (plan.md 04-6 주의사항)
4. **`footer.css`에 `prefers-reduced-motion` 없음** — footer에 애니메이션이 없으면 그대로 두어도 됨
5. **아직 없는 페이지** (현재 라우트는 `#/` 만 구현, 나머지는 "준비 중" 안내): 게임 찾기(`#/find`), 인기 순위(`#/rank`), 신작(`#/new`), 할인(`#/sale`), AI 추천(`#/ai`), 검색(`#/search`), 게임 상세(`#/game/:id`) — 구현 시 `js/components/route-notice.js`의 `IMPLEMENTED` 배열에 추가
6. **데이터**: 장르 정보는 CheapShark에 없어 카드에 장르가 비어 있음 → RAWG/IGDB 연동 시 `game-service.js`의 `genres` 채우기. 인기 순위는 실제 순위가 아니라 "Metacritic 75+ / Steam 긍정 80%+ 중 리뷰 수 순" 기준

## 배포 (GitHub Pages)

- **사이트 주소: https://xorghks1010-xorghks.github.io/gamefinder/** (2026-11-15 배포, `main` 브랜치 루트 기준)
- 코드를 수정한 뒤 `cd gamefinder && git add -A && git commit && git push` 하면 1~2분 뒤 자동 반영됨
- 공개 저장소라 코드와 `docs/`가 누구에게나 보임. Hero·카드의 Steam 아트워크는 개발용 임시 이미지이므로 공개 상태에서 **라이선스 확인/교체**가 더 급해짐
- 배포 주소에서 CheapShark 실데이터 로딩 정상 확인(카드 39개, 오류 없음)

## 알아둘 것

- 개발용 URL 파라미터: `index.html?mock=slow|empty|error` → 예시 데이터/로딩/빈/오류 상태 확인
- 모션 검증 스크립트: 헤드리스 `--screenshot`은 가상 시간 때문에 transition·rAF 가 멈춰 부정확함 → Chrome `--remote-debugging-port` + Node(v26, 내장 WebSocket)로 실제 시간 측정 (예: 스크래치패드 `cdp.js`, 재작성 필요)
- 로컬 화면 확인 방법: Chrome 헤드리스는 창 폭이 약 500px 아래로 안 줄어서 모바일은 `390px` 폭 iframe에 넣어 찍어야 정확함
- git: `gamefinder/` 안에 **전용 저장소**가 있음 (`cd gamefinder && git log`). 첫 커밋 `56304f9` (2026-11-15), GitHub 연결됨(`origin` = https://github.com/xorghks1010-xorghks/gamefinder, **공개** 저장소). 기획서·진행 기록의 **작업용 원본은 상위 폴더**(`plan.md`, `gamefinder-project-plan.html`, `gamefinder-progress.md`)이고, 저장소 `gamefinder/docs/`에는 커밋 시점 **복사본**이 들어 있음 → 다음 커밋 때 상위 원본을 `docs/`에 다시 복사해서 함께 커밋할 것 (`progress.md`는 이름이 다름). 상위 저장소(my-portfolio)에서는 `gamefinder/`가 별도 저장소라 추적하지 않음
- 백업: `gamefinder-backup-2026-11-15/` = **9차(다크 톤) 작업 직전** 버전 (모션·AI 데모 포함, 다크 톤 미포함). 이전 백업은 삭제하고 새로 만듦. `gamefinder.7z`는 11/10 옛 압축본(그대로 둠)
- `CLAUDE.md`의 포트폴리오(스타일 D) 내용은 **별개 작업**이다. 이번 gamefinder 작업과 섞지 말 것. (`style-d-dark.html`은 반응형 CSS만 보완해 둠)

## 작업 로그

- **2026-11-15** — 1~5차 구현 상태를 코드로 확인. 6차 점검 중 명도 대비(`--muted`)와 API 타임아웃을 수정. 데스크톱/모바일 화면 캡처로 레이아웃 확인. 이 기록 파일 생성. (같은 날 포트폴리오 `style-d-dark.html`에 모바일 반응형 CSS도 추가 — 별개 작업)
- **2026-11-15 (이어서)** — 기존 백업 폴더 삭제 후 현재 버전으로 재생성. 7차 모션(motion.js/motion.css) 추가 및 실측 검증. 모바일 390px 확인.
- **2026-11-15 (이어서 2)** — AI 섹션 인터랙티브 데모(8차) 구현·검증, plan.md 04-3 수정.
- **2026-11-15 (이어서 3)** — 백업을 현재 버전으로 교체 후 9차 전체 다크 톤 적용·검증, plan.md 04-2 색상 표 갱신.
- **2026-11-15 (이어서 4)** — 다크 톤 후속 확인(오류·빈·실데이터 화면) 완료, 소소한 색 수정, Hero 이미지 preload/preconnect 적용.
- **2026-11-15 (이어서 5)** — gamefinder 전용 git 저장소 생성, 첫 커밋(31개 파일).
- **2026-11-15 (이어서 6)** — GitHub 공개 저장소 생성·push, GitHub Pages 배포(주소는 위 '배포' 참고).
