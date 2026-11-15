/*
 * Steam 상세 정보 수집 스크립트 — 브라우저는 Steam API 를 직접 못 읽으므로(CORS), 미리 받아서 data/steam/<appId>.json 으로 저장합니다.
 *   실행: node scripts/fetch-steam.mjs          (Node 18+, 외부 패키지 없음)
 *   결과: data/steam/<appId>.json (게임별), data/steam/index.json (갱신 시각·목록)
 *
 * 어떤 게임을 받나: 메인 화면에 나오는 게임 후보 = CheapShark 인기/최신/할인 목록 상위 + 편집 선정 국내 인기작.
 *   (사이트의 js/services/game-service.js 와 같은 조건이며, 여유 있게 더 많이 받아 둡니다. 대량 수집은 하지 않음)
 * 예의: 요청 사이 1.5초 쉬고, 실패한 게임은 건너뜁니다. 메인에서 빠진 게임의 파일은 삭제합니다.
 * 자동 갱신: .github/workflows/update-steam-data.yml 이 하루 한 번 이 스크립트를 실행해 변경분을 커밋합니다.
 */
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'steam');
const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0';
const UA = 'GameFinder-portfolio/1.0 (static site data refresh)';
const DELAY_MS = 1500;
const LIMITS = { popular: 12, latest: 12, sale: 10 };

// js/services/game-service.js 의 KR_PICKS 와 같은 Steam appId (바꾸면 같이 수정)
const KR_APP_IDS = ['578080', '1599340', '582660', '216150', '495910'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const uniqueByApp = (deals) => {
  const seen = new Set();
  return deals.filter((d) => d.steamAppID && !seen.has(d.steamAppID) && seen.add(d.steamAppID));
};

// ---------- 1) 받을 게임 목록 ----------
async function collectAppIds() {
  const ids = new Set(KR_APP_IDS);
  const now = Date.now() / 1000;

  const popQ = `${CHEAPSHARK}/deals?storeID=1&sortBy=Metacritic&metacritic=75&steamRating=80&pageSize=60`;
  const pop = uniqueByApp([...(await getJson(`${popQ}&pageNumber=0`)), ...(await getJson(`${popQ}&pageNumber=1`))])
    .sort((a, b) => b.steamRatingCount - a.steamRatingCount).slice(0, LIMITS.popular);

  const newQ = `${CHEAPSHARK}/deals?storeID=1&sortBy=Release&steamRating=70&pageSize=60`;
  const latest = uniqueByApp([...(await getJson(`${newQ}&pageNumber=0`)), ...(await getJson(`${newQ}&pageNumber=1`))])
    .filter((d) => d.releaseDate > 0 && d.releaseDate <= now && parseInt(d.steamRatingCount, 10) >= 50)
    .sort((a, b) => b.releaseDate - a.releaseDate).slice(0, LIMITS.latest);

  const sale = uniqueByApp(await getJson(`${CHEAPSHARK}/deals?storeID=1,25&onSale=1&sortBy=DealRating&lowerPrice=5&steamRating=75&pageSize=40`))
    .slice(0, LIMITS.sale);

  for (const d of [...pop, ...latest, ...sale]) ids.add(String(d.steamAppID));
  return [...ids];
}

// ---------- 2) Steam 응답 정리 ----------
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&rsquo;': '’', '&lsquo;': '‘' };
const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
const stripTags = (s) => decode(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// '<li><strong>OS:</strong> Windows 10</li>' → [['OS', 'Windows 10'], ...]
function parseRequirements(html) {
  if (!html || typeof html !== 'string') return [];
  const rows = [];
  const re = /<li[^>]*>\s*<strong>([^<]*?)<\/strong>\s*([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) {
    const label = stripTags(m[1]).replace(/[:：]\s*$/, '');
    const value = stripTags(m[2]);
    if (label && value) rows.push([label, value]);
  }
  return rows;
}

function toRecord(appId, d) {
  const shots = (d.screenshots || []).slice(0, 8).map((s) => ({ thumb: s.path_thumbnail, full: s.path_full }));
  const desc = stripTags(d.short_description || '');
  return {
    id: String(appId),
    name: d.name,
    description: desc,
    descLang: /[가-힣]/.test(desc) ? 'ko' : 'en',     // 한국어 설명이 없는 게임은 영문이 옴 (사이트에서 번역 버튼 제공)
    genres: (d.genres || []).map((g) => g.description),
    developers: d.developers || [],
    publishers: d.publishers || [],
    screenshots: shots,
    requirements: parseRequirements(d.pc_requirements && d.pc_requirements.minimum),
    koreanSupport: /한국어|korean/i.test(stripTags((d.supported_languages || '').split('<br')[0])),
    isFree: !!d.is_free,
    fetchedAt: new Date().toISOString()
  };
}

// ---------- 3) 실행 ----------
async function main() {
  await mkdir(OUT, { recursive: true });
  const ids = await collectAppIds();
  console.log(`대상 ${ids.length}개 게임`);

  const done = [];
  for (const id of ids) {
    try {
      const json = await getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=koreana&cc=kr`);
      const entry = json[id];
      if (!entry || !entry.success) { console.log(`- ${id}: Steam 이 정보를 주지 않음(건너뜀)`); }
      else {
        const rec = toRecord(id, entry.data);
        await writeFile(path.join(OUT, `${id}.json`), JSON.stringify(rec, null, 1) + '\n', 'utf8');
        done.push(id);
        console.log(`- ${id}: ${rec.name} (${rec.descLang}, 스크린샷 ${rec.screenshots.length}, 요구사항 ${rec.requirements.length})`);
      }
    } catch (e) {
      console.log(`- ${id}: 실패 (${e.message})`);
    }
    await sleep(DELAY_MS);
  }

  // 이번 대상에서 빠진 오래된 파일 정리 (받기에 실패한 대상은 기존 파일을 남김)
  const keep = new Set(ids.map((i) => `${i}.json`));
  for (const f of await readdir(OUT)) {
    if (f !== 'index.json' && f.endsWith('.json') && !keep.has(f)) { await unlink(path.join(OUT, f)); console.log(`삭제: ${f}`); }
  }
  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ updatedAt: new Date().toISOString(), ids: done }, null, 1) + '\n', 'utf8');
  console.log(`완료: ${done.length}/${ids.length}개 저장`);
}

main().catch((e) => { console.error(e); process.exit(1); });
