/*
 * Steam 인기 차트 수집 스크립트 — 브라우저는 Steam API 를 직접 못 읽으므로(CORS), 미리 받아서 data/charts/steam-most-played.json 으로 저장합니다.
 *   실행: node scripts/fetch-charts.mjs          (Node 18+, 외부 패키지 없음)
 *   결과: data/charts/steam-most-played.json (이 스크립트가 다음 실행에서 쓰는 원본·이름 캐시)
 *         data/charts/steam-most-played.js   (사이트가 <script> 로 읽는 파일 — 파일로 직접 열어도(file://) 동작하도록 .json 대신 씀)
 *
 * 데이터 출처:
 *   - 순위·지난주 순위·최대 동시접속자: Steam 공식 차트 ISteamChartsService/GetMostPlayedGames (API 키 불필요, 하루 단위 집계)
 *     peak_in_game = 해당 집계일의 "최대 동시접속자 수"(그날 가장 많이 접속한 순간의 수)
 *   - 게임 이름: Steam 상점 appdetails (차트 응답에는 이름이 없고 appid 만 있음). 영어 이름으로 받음(사이트의 다른 목록과 같은 표기)
 * 예의: 이름은 아직 모르는 게임만 받고(이전 결과 재사용), 요청 사이 1.5초 쉽니다. 이름을 못 받은 게임·게임이 아닌 항목은 제외합니다.
 * 자동 갱신: .github/workflows/update-steam-data.yml 에서 fetch-steam.mjs 다음에 실행합니다.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'charts');
const OUT_FILE = path.join(OUT_DIR, 'steam-most-played.json');
const OUT_JS = path.join(OUT_DIR, 'steam-most-played.js');
const CHART_URL = 'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';
const UA = 'GameFinder-portfolio/1.0 (static site data refresh)';
const DELAY_MS = 1500;
const TOP = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// 이전 결과에서 이미 알고 있는 이름 (게임 이름은 거의 안 바뀌므로 재사용해서 요청을 줄임)
async function loadKnownNames() {
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    return Object.fromEntries((prev.known || []).map((k) => [k.appid, k]));
  } catch { return {}; }
}

async function fetchName(appid) {
  const json = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic&l=english&cc=us`);
  const entry = json[appid];
  if (!entry || !entry.success) return null;
  return { appid, name: entry.data.name, type: entry.data.type, isFree: !!entry.data.is_free };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const chart = (await getJson(CHART_URL)).response;
  const ranks = (chart.ranks || []).slice(0, TOP);
  console.log(`차트 ${ranks.length}개 (집계일 ${new Date(chart.rollup_date * 1000).toISOString().slice(0, 10)})`);

  const known = await loadKnownNames();
  let fetched = 0;
  for (const r of ranks) {
    if (known[r.appid]) continue;
    try {
      const info = await fetchName(r.appid);
      known[r.appid] = info || { appid: r.appid, name: null, type: null, isFree: false };
      console.log(`- ${r.rank}위 ${r.appid}: ${info ? `${info.name} (${info.type})` : '이름 정보 없음(제외)'}`);
    } catch (e) {
      console.log(`- ${r.rank}위 ${r.appid}: 실패 (${e.message}) — 이번엔 제외`);
    }
    fetched++;
    await sleep(DELAY_MS);
  }

  const items = [];
  for (const r of ranks) {
    const k = known[r.appid];
    if (!k || !k.name || k.type !== 'game') continue;    // 이름 없음·게임이 아닌 항목(소프트웨어 등) 제외
    items.push({
      rank: r.rank,                                       // Steam 공식 순위 (제외된 항목 때문에 번호가 건너뛸 수 있음)
      appid: String(r.appid),
      name: k.name,
      lastWeekRank: r.last_week_rank || 0,                // 0 = 지난주 순위권 밖(신규 진입)
      peak: r.peak_in_game,
      isFree: k.isFree
    });
  }

  const out = {
    updatedAt: new Date().toISOString(),
    rollupDate: new Date(chart.rollup_date * 1000).toISOString().slice(0, 10),
    items,
    known: Object.values(known)                           // 다음 실행에서 이름을 다시 받지 않도록 보관
  };
  await writeFile(OUT_FILE, JSON.stringify(out, null, 1) + '\n', 'utf8');
  const { known: _cache, ...forSite } = out;                   // 사이트에는 이름 캐시를 빼고 보냄
  await writeFile(OUT_JS, '// 자동 생성 파일 — scripts/fetch-charts.mjs 가 만듭니다. 직접 고치지 마세요.\n(window.GameFinder = window.GameFinder || {}).chartData = ' + JSON.stringify(forSite) + ';\n', 'utf8');
  console.log(`완료: ${items.length}개 저장 (이름 새로 받은 게임 ${fetched}개, 제외 ${ranks.length - items.length}개)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
