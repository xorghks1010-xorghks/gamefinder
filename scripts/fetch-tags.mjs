/*
 * 세부 분류(태그) 수집 스크립트 — Steam 공식 장르에는 FPS·공포·오픈 월드·소울라이크 같은 분류가 없습니다(Action 등 10여 개뿐).
 * 그런 분류는 Steam 사용자가 투표로 붙이는 "태그"이고, SteamSpy(https://steamspy.com)가 게임별 태그와 투표 수를 무료로 줍니다.
 * 카탈로그의 게임마다 태그를 받아 "게임 찾기"의 세부 분류 필터·검색·AI 추천에 씁니다.
 *   실행: node scripts/fetch-tags.mjs          (Node 18+, 외부 패키지 없음. 처음엔 약 12분, 이후엔 새 게임만)
 *   결과: data/catalog/tags.js        (사이트가 <script> 로 읽는 파일 — 게임 id → 세부 분류 id 목록)
 *         data/catalog/tags-known.json (원본 투표 수 캐시 — 사이트는 읽지 않음. 이게 있으면 기준값을 바꿔도 다시 받지 않고 tags.js 만 다시 만듦)
 *
 * 태그는 사용자 투표라 "정확한 분류"가 아니라 "많은 사람이 그렇게 느낀다"는 뜻입니다.
 * 그래서 한 게임의 최다 득표 태그 대비 RATIO 이상 득표했고 상위 TOP_N 안에 든 태그만 인정합니다. (아래 상수를 조정하세요)
 * 예의: SteamSpy 는 초당 1회 제한 → 요청 사이 1.2초 쉼. 이미 받은 게임은 건너뛰고(60일 지나면 갱신), 25개마다 저장하므로 끊겨도 이어서 받음.
 * 출처 표기: SteamSpy (사이트 하단 안내문에 표시)
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'catalog');
const KNOWN_FILE = path.join(DIR, 'tags-known.json');
const OUT_JS = path.join(DIR, 'tags.js');
const UA = 'GameFinder-portfolio/1.0 (static site data refresh)';
const DELAY_MS = 1200;
const REFRESH_DAYS = 60;

// ---- 인정 기준 (조정 가능) ----
// (2026-11 카탈로그 583개로 비교해 정함: 0.3/12 는 DOOM 이 공포, Fallout 3 이 FPS 로 나오는 식의 오분류가 많고,
//  0.4/10 은 그런 오분류가 줄지만 Deep Rock Galactic 처럼 경계에 있는 게임 몇 개가 빠짐. 0.5 이상은 빠지는 게임이 너무 많음)
const RATIO = 0.4;     // 그 게임의 최다 득표 태그의 40% 이상 득표해야 인정
const TOP_N = 10;      // 득표 순위 상위 10개 안에 들어야 인정
const MIN_VOTES = 50;  // 득표가 너무 적으면 무시

// 사이트의 세부 분류 id ↔ SteamSpy 태그 이름 (js/components/page-configs.js 의 sub 칩 id 와 같게 유지)
const SUB = {
  fps:         ['FPS'],
  tps:         ['Third-Person Shooter'],
  shooter:     ['Shooter'],
  battleroyale:['Battle Royale'],
  horror:      ['Horror'],
  puzzle:      ['Puzzle'],
  platformer:  ['Platformer', '2D Platformer', '3D Platformer'],
  fighting:    ['Fighting'],
  roguelike:   ['Roguelike', 'Roguelite', 'Roguelike Deckbuilder', 'Action Roguelike'],
  soulslike:   ['Souls-like'],
  metroidvania:['Metroidvania'],
  openworld:   ['Open World'],
  survival:    ['Survival'],
  sandbox:     ['Sandbox'],
  turnbased:   ['Turn-Based Strategy', 'Turn-Based Combat', 'Turn-Based Tactics', 'Turn-Based'],
  citybuilder: ['City Builder'],
  storyrich:   ['Story Rich']
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

async function fetchTags(appid) {
  const res = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, { headers: { 'User-Agent': UA } });
  if (res.status === 429 || res.status === 503) { const e = new Error(String(res.status)); e.rate = true; throw e; }
  if (!res.ok) throw new Error(`${res.status}`);
  const d = await res.json();
  const tags = d && d.tags && !Array.isArray(d.tags) ? d.tags : {};          // 태그가 없으면 빈 배열로 옴
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 20);
  return { tags: Object.fromEntries(top), fetchedAt: new Date().toISOString() };
}

// 원본 투표 수 → 인정된 세부 분류 id 목록
function decide(tags) {
  const ranked = Object.entries(tags || {}).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return [];
  const topVotes = ranked[0][1];
  const rank = Object.fromEntries(ranked.map(([name], i) => [name, i]));
  const out = [];
  for (const [id, names] of Object.entries(SUB)) {
    const best = Math.max(...names.map((n) => (rank[n] !== undefined && rank[n] < TOP_N ? tags[n] : 0)));
    if (best >= MIN_VOTES && best >= topVotes * RATIO) out.push(id);
  }
  return out;
}

async function writeOut(known, ids) {
  const map = {};
  ids.forEach((id) => { const r = known[id]; if (r) { const t = decide(r.tags); if (t.length) map[id] = t; } });
  await writeFile(OUT_JS, '// 자동 생성 파일 — scripts/fetch-tags.mjs 가 만듭니다(데이터: SteamSpy). 직접 고치지 마세요.\n(window.GameFinder = window.GameFinder || {}).tagData = ' +
    JSON.stringify({ updatedAt: new Date().toISOString(), map }) + ';\n', 'utf8');
  await writeFile(KNOWN_FILE, JSON.stringify(known) + '\n', 'utf8');
  return Object.keys(map).length;
}

async function main() {
  await mkdir(DIR, { recursive: true });
  const catalogKnown = await readJson(path.join(DIR, 'known.json'), []);
  const ids = catalogKnown.filter((r) => r && !r.skip).map((r) => String(r.id));
  if (!ids.length) throw new Error('data/catalog/known.json 이 없습니다. 먼저 node scripts/fetch-catalog.mjs 를 실행하세요.');
  const known = await readJson(KNOWN_FILE, {});
  const fresh = (r) => r && Date.now() - new Date(r.fetchedAt).getTime() < REFRESH_DAYS * 86400000;
  const todo = ids.filter((id) => !fresh(known[id]));
  console.log(`게임 ${ids.length}개, 새로 받을 게임 ${todo.length}개 (예상 ${Math.ceil(todo.length * DELAY_MS / 60000)}분)`);

  let n = 0;
  for (const id of todo) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { known[id] = await fetchTags(id); break; }
      catch (e) {
        if (e.rate) { console.log('  속도 제한 — 60초 대기'); await sleep(60000); continue; }
        console.log(`- ${id}: 실패 (${e.message})`); break;
      }
    }
    n++;
    if (n % 25 === 0) { const c = await writeOut(known, ids); console.log(`  … ${n}/${todo.length} (세부 분류가 붙은 게임 ${c}개)`); }
    await sleep(DELAY_MS);
  }
  const withTags = await writeOut(known, ids);
  console.log(`완료: 세부 분류가 붙은 게임 ${withTags}개 / ${ids.length}개 (이번에 받은 ${n}개)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
