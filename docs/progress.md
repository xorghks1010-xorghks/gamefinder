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
- 성능(일부): `index.html`에 preconnect(jsdelivr·steam CDN·cheapshark) + 첫 Hero 이미지 preload 추가, `hero.js` 첫 슬라이드 이미지 `fetchpriority=high`(나머지 low)·`decoding=async`. **preload 주소(첫 슬라이드의 Steam hero 이미지)는 `data/hero-slides.js` 첫 슬라이드와 같아야 함** (바꾸면 같이 수정). Lighthouse 실측은 아직 안 함

## 8차: AI 섹션 인터랙티브 데모

- 취향 문구 3개(`스토리가 탄탄한 RPG` / `혼자 즐기는 힐링 게임` / `친구와 함께하는 협동 액션`)를 `<button aria-pressed>`로 변경. 누르면 0.65초 "취향을 분석하는 중…" 후 예시 추천 3개(커버·제목·추천 이유) 표시, 같은 칩을 다시 누르면 해제. 처음엔 첫 번째 칩이 선택된 상태
- **실제 AI 호출 아님**: 칩별 게임 3개와 이유는 `ai-intro.js`의 `DEMOS`에 하드코딩, 게임 정보는 `data/mock/games.js`에서 id로 조회. 화면에 "예시 미리보기" 배지 + 안내 문구 표시. 적합도 점수는 만들지 않음
- 선택 상태는 색뿐 아니라 ✓ 표시·굵기로도 구분, 결과 영역 `aria-live="polite"`, 모션 줄이기 시 분석 연출 생략
- 기획서 `plan.md` 04-3 AI 추천 소개 행의 "클릭 기능 추가하지 않음"을 위 내용으로 수정함
- 검증: Chrome 원격제어로 실제 클릭 → 선택/분석중/결과/해제 상태와 JS 오류 없음 확인, 1440px·390px 화면 확인
- 나중에 할 일: 실제 AI 추천 페이지(`#/ai`)를 만들면 이 데모의 문구·결과와 톤을 맞출 것. 추천 이유 문구는 직접 쓴 예시이니 필요하면 수정

## 14차: 게임 상세 페이지 `#/game/<id>` (2026-11-15)

- **라우팅**: 같은 페이지에서 메인(`<main id="main">`) ↔ 상세(`<main id="detail">`) 전환(`main.js`의 `onRoute`). 메인에서 상세로 갈 때 스크롤 위치를 저장해 **뒤로가기 시 복원**. 주소창에 `#/game/...`을 직접 입력해도 동작. 카드 링크는 기존 `gameHref(id)` 그대로. `routes.js`에 `currentGameId()` 추가, `route-notice.js`는 `#/game/`을 구현된 경로로 취급(안내 문구도 수정)
- **파일**: `js/components/game-detail.js`(화면), `css/game-detail.css`(스타일), `game-service.js`의 `getGameDetail(id)`(데이터)
- **id 종류**: 숫자 = Steam appId / `ftg-<번호>` = FreeToGame 게임(국내 최신 목록의 카드) / 그 외 = 예시 데이터(`?mock=`)
- **화면 구성**: 상단 배너(Steam hero 이미지, 제목, 장르·PC·출시일 칩, Steam 긍정%·Metacritic, 'Steam에서 보기'/'무료로 플레이하기' 버튼) / 본문(스토어 정보 = **Steam 공식 스토어 위젯 iframe**, 소개, 스크린샷, 최소 시스템 요구사항) / 사이드(게임 정보, **스토어별 가격 비교 표** + 최저가 표시 + 역대 최저가). 데이터가 없는 섹션은 숨김. 로딩 스켈레톤 · 없는 게임(`notfound`) · 오류(다시 시도) 상태, 접근성(h1 포커스 이동, 문서 제목 변경)
- **데이터 출처**: CheapShark(`/deals?steamAppID`, `/games?id`, `/stores`) + FreeToGame(`/api/game?id` — 설명(영문)·스크린샷·요구사항) + Steam 위젯. **Steam 유료 게임은 소개·스크린샷을 가져올 방법이 없어**(Steam API는 브라우저 호출 불가) 위젯(Steam 제공)으로 대신함. 소개 글은 FreeToGame 영문
- **발견·주의**: (1) 브라우저에서 CheapShark `/games?steamAppID=` 만 `Failed to fetch`(curl로는 성공) → 제목으로 `/games?title=` 검색 후 steamAppID 일치 항목을 고름. 실제 브라우저로 테스트해야 잡히는 문제였음. (2) `dealID`는 API가 이미 인코딩해서 주므로 **그대로** 붙여야 함 → 기존 할인 카드의 `encodeURIComponent` 이중 인코딩을 `dealUrl()`로 수정. **스토어 이동 링크가 실제 상품 페이지로 가는지는 CheapShark 봇 확인(Cloudflare) 때문에 자동 테스트로 확인하지 못함 → 직접 클릭해서 확인 필요**
- 검증: Chrome 원격제어로 카드 클릭→상세→뒤로가기(스크롤 600 복원), 직접 주소 진입(Steam 유료 / 국내 PUBG / FreeToGame / 없는 게임 / 예시 데이터), 1440px·390px. JS 오류 없음
- 한계: '관련 게임'·리뷰·한국어 설명 없음. 인기 TOP5의 KR 게임 중 FreeToGame에 없는 게임(검은사막 등)은 설명 없이 위젯만 나올 수 있음

## 12차: 국내 온라인 게임 데이터 합치기 (FreeToGame, 2026-11-15)

- 요구: **국내 온라인 게임 전용 섹션은 만들지 말고**, 기존 섹션에 비교해서 함께 넣기
- 데이터: **FreeToGame**(`https://www.freetogame.com/api/games?platform=pc`) — 무료·키 불필요·CORS 허용. **조건: 출처 링크 표기**(푸터 `.gf-footer__credit`에 링크 추가함). 국내 게임 약 41개(메이플스토리·로스트아크·리니지2·마비노기·Aion 2 등), 단 **무료(F2P) 게임만**, 설명 영어, 인기 지표 없음
- **합친 곳**
  - **최신 게임**: 최근 1년 내 출시된 국내 PC 게임(개발사·퍼블리셔가 국내 회사)을 **최대 3개**, Steam 목록의 3·6·8번째 자리에 섞음(출시일로만 정렬하면 맨 끝으로 밀려 스크롤해야 보여서). 카드 메타에 `· 국내` 표시. 현재 예: Vampir, Aion 2, RF Online Next. Steam과 제목이 같은 게임은 Steam 쪽만 사용(중복 제거, `normTitle`)
  - **장르 보강**: 제목이 같은 Steam 게임(예: Counter-Strike 2, PUBG)에 FreeToGame 장르를 채움(인기·최신 목록)
- **인기 TOP 5 (13차에서 추가)**: 실제 순위 데이터는 섞을 수 없어서, **1~3위는 Steam 리뷰 수 기준 실제 순위**, **4·5번째 자리에 편집 선정 국내 인기작 2개**(현재 PUBG, Lost Ark)를 섞음. 순위 숫자 대신 `KR`, 평점 칩 없음, 메타에 `· 국내`. 섹션 제목은 "글로벌 인기 게임 TOP 5" → **"인기 게임 TOP 5"** 로 변경(국내 게임이 섞여서). 전체 순위 페이지(`#/rank`, 기획서의 '글로벌 인기 순위')는 미구현이라 이름 그대로임. 후보 목록 `KR_PICKS`(PUBG·Lost Ark·Black Desert·MapleStory·Dungeon Fighter Online, 모두 Steam 이미지 확인함)에서 앞 2개를 쓰고 이미 Steam 순위에 있으면 건너뜀. 섹션 안내 문구에 "KR 표시 2개는 편집 선정으로 순위에 포함되지 않음" 명시. **사람이 고른 목록이라 실시간 순위가 아님 — 바꾸려면 `game-service.js`의 `KR_PICKS`/`KR_PICK_COUNT` 수정**
- **합치지 않은 곳**: 할인(FreeToGame은 무료 게임이라 해당 없음). 인기 순위 자체의 '비교'는 불가(FreeToGame엔 리뷰 수가 없음)
- 구현: `game-service.js`(`fetchCached` 일반화, `getFtg`, `domesticRecent`, `fillGenres`, `KR_COMPANY` 정규식, `DOMESTIC_MAX=3`, `DOMESTIC_WINDOW_DAYS=365`), `game-card.js`(`origin==='KR'`이면 `국내`), `main.js`(최신 섹션 안내 문구), `footer.js`(출처 링크)
- **FreeToGame 실패 시 안전**: 요청이 막혀도 `[]`로 대체되어 Steam 8개만 정상 표시됨(차단 테스트로 확인)
- 주의: 국내 판별은 개발사·퍼블리셔 이름 정규식(`KR_COMPANY`)이라 틀릴 수 있음(Guild Wars는 제외 목록에 있음). 국내 게임 이미지는 FreeToGame 썸네일(365×206)
- 나중에: 국내 모바일 게임은 iTunes Search API(키 불필요, CORS 허용), 장르·이미지 보강은 RAWG(무료 키, 출처 링크 필수)를 후보로 검토. 게임트릭스(PC방 순위)는 공개 API 근거를 못 찾아 사용하지 않음

## 11차: 이미지 교체 → **원복됨** (2026-11-15)

> **현재 상태: 원복 완료.** Hero·장르 이미지는 다시 Steam 아트워크를 쓰고 `assets/` 폴더는 없음. 아래는 당시 시도한 내용이며, 다시 하고 싶으면 커밋 `e3aa040`에 SVG 10장과 코드 변경이 그대로 남아 있음(`git show e3aa040`). 원복 커밋으로 되돌렸으므로 필요하면 `git revert <원복 커밋>`으로 재적용 가능.

- **Hero 배경 3장**(`assets/hero/ai.svg`, `sale.svg`, `rank.svg`)과 **장르 타일 7장**(`assets/genre/rpg·action·horror·fps·strategy·adventure·simulation.svg`)을 **직접 그린 오리지널 SVG**로 교체. 게임 아트워크(Cyberpunk/Hades/ELDEN RING 등 Steam hero 이미지) 사용 제거 → 저작권 문제 없음
- 내용: AI = 별자리 같은 네트워크+중심 구체(보라), 할인 = 황금 할인 태그(앰버), 순위 = 별 달린 순위 막대(블루), 장르 = 성/슬래시/달밤 숲/조준경/육각 지도/산/농장 일러스트
- `data/hero-slides.js`(image·imageAlt), `data/mock/games.js`(GENRES.image), `index.html`(preload) 수정. 대체 텍스트(alt)도 새 그림에 맞게 변경
- **남긴 것: 게임 카드 표지(Steam CDN `library_600x900` 등)**. 실제 게임 목록을 보여주는 데이터라 유지. 그림을 바꾸려면 `assets/`의 SVG를 같은 파일명으로 덮어쓰면 됨(Hero는 1920×1000, 장르는 800×500 비율)
- SVG 생성 스크립트는 임시 폴더에만 있었고 저장소에는 없음. 수정이 필요하면 SVG를 직접 편집

## 10차: 키보드·태블릿 점검 (2026-11-15, 배포 주소에서 실제 입력으로 검증)

- Tab 이동 30단계: 건너뛰기 링크 → 로고 → 메뉴 → 검색 → Hero CTA·화살표·점 → 인기 전체보기 → 카드 → 최신 화살표·카드 순으로 논리적, 모든 단계 `:focus-visible` 윤곽선 표시 확인
- Hero 방향키(→ ←) 슬라이드 전환, 모바일 메뉴 Esc 닫힘 + 포커스가 토글 버튼으로 복귀 확인
- 태블릿 768px: 가로 넘침 없음, 레이아웃 정상. **문제 1건 수정**: Hero 좌우 화살표가 라벨/제목과 겹침 → 960px 이하에서 하단 오른쪽(점 줄)으로 이동 (`css/hero.css`). 600px 이하는 원래 화살표 숨김(스와이프)
- 검증 스크립트는 임시 폴더에 만들어 썼고 저장소에는 없음(다시 필요하면 Chrome `--remote-debugging-port` + Node 내장 WebSocket으로 재작성)

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

1. **실제 기기 수동 점검** (자동 점검은 끝남 — 아래 '10차' 참고). 남은 것: 실제 폰에서 Hero 스와이프·최신 게임 가로 스크롤 손맛 확인
2. **성능**: preload/preconnect는 적용함. 남은 것: Lighthouse 실측, 이미지가 Steam CDN 원본이라 큼 → 필요하면 썸네일 크기 조정
3. **이미지 라이선스**: `data/hero-slides.js`(Hero 3장)·`data/mock/games.js`(장르 타일 7장)의 Steam 아트워크는 개발용 임시. 공개 상태이므로 배포 전 사용 조건 확인/교체 필요. (자체 제작 SVG로 교체해 본 적 있으나 **사용자 요청으로 원복**함 — 11차 참고)
4. **`footer.css`에 `prefers-reduced-motion` 없음** — footer에 애니메이션이 없으면 그대로 두어도 됨
5. **아직 없는 페이지** (구현: 메인 `#/`, 게임 상세 `#/game/:id`. 나머지는 "준비 중" 안내): 게임 찾기(`#/find`), 인기 순위(`#/rank`), 신작(`#/new`), 할인(`#/sale`), AI 추천(`#/ai`), 검색(`#/search`) — 구현 시 `js/components/route-notice.js`의 `IMPLEMENTED` 배열에 추가
6. **데이터**: 장르 정보는 CheapShark에 없음 → 12차에서 FreeToGame과 제목이 겹치는 게임만 부분 보강. 전체를 채우려면 RAWG/IGDB 연동 필요(`game-service.js`의 `genres`). 인기 순위는 실제 순위가 아니라 "Metacritic 75+ / Steam 긍정 80%+ 중 리뷰 수 순" 기준

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
- **2026-11-15 (이어서 7)** — 키보드·태블릿 점검(10차) 완료, 태블릿 Hero 화살표 겹침 수정.
- **2026-11-15 (이어서 8)** — 11차 이미지 교체: Hero·장르 이미지를 자체 제작 SVG 10장으로 교체(게임 표지는 유지).
- **2026-11-15 (이어서 9)** — 사용자 요청으로 11차 이미지 교체를 원복(Hero·장르 모두 Steam 아트워크로 복구, `assets/` 삭제). 이력은 `e3aa040`에 보존.
- **2026-11-15 (이어서 10)** — 12차: FreeToGame 국내 온라인 게임을 최신 게임 목록에 합치고 장르 보강, 출처 링크 추가.
- **2026-11-15 (이어서 11)** — 13차: 인기 TOP 5 에 편집 선정 국내 인기작 2개(KR 표시) 섞기.
- **2026-11-15 (이어서 12)** — 인기 섹션 제목에서 '글로벌' 삭제.
- **2026-11-15 (이어서 13)** — 14차: 게임 상세 페이지 구현(라우팅·가격 비교·Steam 위젯·FreeToGame 상세), 할인 링크 dealID 이중 인코딩 수정.
