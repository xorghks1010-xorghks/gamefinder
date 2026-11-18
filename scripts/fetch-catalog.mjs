/*
 * 게임 카탈로그 수집 스크립트 — "게임 찾기(#/find)"가 장르·플레이 방식으로 거를 수 있도록,
 * 인기 게임들의 장르/플레이 방식/출시일/평점/리뷰 수를 미리 받아 data/catalog/games.json 으로 저장합니다.
 *   실행: node scripts/fetch-catalog.mjs          (Node 18+, 외부 패키지 없음. 처음엔 약 15분, 이후엔 새 게임만 받아 빠름)
 *   결과: data/catalog/games.js (사이트가 <script> 로 읽는 파일 — 파일로 직접 열어도(file://) 동작하도록 .json 대신 씀),
 *         data/catalog/known.json (다음 실행에서 이미 받은 게임을 건너뛰기 위한 내부 캐시 — 사이트는 읽지 않음)
 *
 * 왜 미리 받나: 브라우저는 Steam API 를 직접 못 읽고(CORS), CheapShark 는 장르를 주지 않음.
 * 어떤 게임을 받나(후보): ① Steam 인기 차트(data/charts) ② CheapShark Metacritic 상위 8페이지(약 480개, 사이트의 인기 후보 풀과 같음)
 *   ③ 편집 선정 국내 인기작 ④ 이미 받아 둔 data/steam 의 게임. 대량 수집은 하지 않음(약 600개).
 * 예의: 이미 받은 게임은 다시 받지 않고(30일 지나면 갱신), 요청 사이 1.7초 쉬고, 속도 제한(429)이 오면 1분 기다립니다.
 *       중간에 끊겨도 25개마다 저장하므로 다시 실행하면 이어서 받습니다.
 * 자동 갱신: .github/workflows/update-steam-data.yml 에서 다른 스크립트 다음에 실행합니다.
 */
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'catalog');
const OUT_FILE = path.join(OUT_DIR, 'games.js');
const OLD_JSON = path.join(OUT_DIR, 'games.json');         // 예전 형식 (이어받기용으로만 읽음)
const KNOWN_FILE = path.join(OUT_DIR, 'known.json');
const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0';
const UA = 'GameFinder-portfolio/1.0 (static site data refresh)';
const DELAY_MS = 1700;
const REFRESH_DAYS = 30;
const POP_PAGES = 8;                                  // js/services/game-service.js 의 POP_PAGES 와 같게
const KR_APP_IDS = ['578080', '1599340', '582660', '216150', '495910'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 429) { const e = new Error('429'); e.rate = true; throw e; }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

// ---------- 1) 후보 appid ----------
async function collectCandidates() {
  const ids = new Set(KR_APP_IDS);
  const chart = await readJson(path.join(ROOT, 'data', 'charts', 'steam-most-played.json'), null);
  (chart?.items || []).forEach((i) => ids.add(String(i.appid)));
  try {
    for (const f of await readdir(path.join(ROOT, 'data', 'steam'))) {
      if (/^\d+\.json$/.test(f)) ids.add(f.replace('.json', ''));
    }
  } catch { /* 없으면 건너뜀 */ }
  for (let p = 0; p < POP_PAGES; p++) {
    const deals = await getJson(`${CHEAPSHARK}/deals?storeID=1&sortBy=Metacritic&metacritic=75&steamRating=80&pageSize=60&pageNumber=${p}`);
    deals.forEach((d) => d.steamAppID && ids.add(String(d.steamAppID)));
    await sleep(1000);
  }
  return [...ids];
}

// ---------- 2) Steam 응답 정리 ----------
const TAG_OF = { 'Single-player': 'single', 'Multi-player': 'multi', 'Co-op': 'coop', 'PvP': 'pvp' };
const GENRES = ['Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports', 'Racing', 'Indie', 'Casual', 'Massively Multiplayer'];

function parseDate(text) {            // 'Feb 24, 2022' / 'Nov 2025' / '2024' → 'YYYY-MM-DD' (월·일이 없으면 1일로)
  if (!text) return null;
  const t = Date.parse(/^\d{4}$/.test(text) ? `Jan 1, ${text}` : /^[A-Za-z]{3} \d{4}$/.test(text) ? text.replace(' ', ' 1, ') : text);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function toRecord(appid, d) {
  const cats = (d.categories || []).map((c) => c.description);
  return {
    id: String(appid),
    name: d.name,
    genres: (d.genres || []).map((g) => g.description).filter((g) => GENRES.includes(g)),
    tags: [...new Set(cats.map((c) => TAG_OF[c]).filter(Boolean))],
    free: !!d.is_free,
    released: d.release_date && !d.release_date.coming_soon ? parseDate(d.release_date.date) : null,
    metacritic: d.metacritic ? d.metacritic.score : null,
    reviews: d.recommendations ? d.recommendations.total : 0,
    fetchedAt: new Date().toISOString()
  };
}

async function fetchOne(appid) {
  const json = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,genres,categories,release_date,metacritic,recommendations&l=english&cc=us`);
  const entry = json[appid];
  if (!entry || !entry.success) return { id: String(appid), skip: true, fetchedAt: new Date().toISOString() };
  if (entry.data.type !== 'game') return { id: String(appid), skip: true, fetchedAt: new Date().toISOString() };   // DLC·소프트웨어 등 제외
  return toRecord(appid, entry.data);
}

// ---------- 3) 실행 ----------
async function save(map, candidates) {
  const items = candidates.map((id) => map[id]).filter((r) => r && !r.skip)
    .map(({ fetchedAt, ...rest }) => rest);                 // 사이트에는 필요한 필드만 (갱신 시각은 known.json 에만)
  await writeFile(OUT_FILE, '// 자동 생성 파일 — scripts/fetch-catalog.mjs 가 만듭니다. 직접 고치지 마세요.\n(window.GameFinder = window.GameFinder || {}).catalogData = ' +
    JSON.stringify({ updatedAt: new Date().toISOString(), items }) + ';\n', 'utf8');
  await writeFile(KNOWN_FILE, JSON.stringify(Object.values(map)) + '\n', 'utf8');
  return items.length;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const known = await readJson(KNOWN_FILE, null) ?? (await readJson(OLD_JSON, { known: [] })).known ?? [];   // 예전 형식(games.json 안의 known)도 읽음
  const map = Object.fromEntries(known.map((r) => [r.id, r]));
  const candidates = await collectCandidates();
  const fresh = (r) => r && Date.now() - new Date(r.fetchedAt).getTime() < REFRESH_DAYS * 86400000;
  const todo = candidates.filter((id) => !fresh(map[id]));
  console.log(`후보 ${candidates.length}개, 새로 받을 게임 ${todo.length}개 (예상 ${Math.ceil(todo.length * DELAY_MS / 60000)}분)`);

  let n = 0;
  for (const id of todo) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { map[id] = await fetchOne(id); break; }
      catch (e) {
        if (e.rate) { console.log('  속도 제한 — 60초 대기'); await sleep(60000); continue; }
        console.log(`- ${id}: 실패 (${e.message})`); break;
      }
    }
    n++;
    if (n % 25 === 0) { const c = await save(map, candidates); console.log(`  … ${n}/${todo.length} (저장된 게임 ${c}개)`); }
    await sleep(DELAY_MS);
  }
  const count = await save(map, candidates);
  console.log(`완료: 게임 ${count}개 저장 (이번에 받은 ${n}개, 게임이 아니거나 정보 없음 ${candidates.length - count}개)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
