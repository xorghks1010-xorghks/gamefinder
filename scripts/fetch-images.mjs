/*
 * Steam 이미지 주소 수집 스크립트 — Steam 이 최근 게임부터 이미지 주소에 해시(긴 문자열)를 넣는 방식으로 바꿨습니다.
 *   예전 규칙: https://cdn.cloudflare.steamstatic.com/steam/apps/<번호>/header.jpg
 *   새 방식  : https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<번호>/<해시>/header.jpg
 * 사이트는 번호만으로 예전 주소를 만들어 쓰고 있어서, 최근 출시작(예: AION 2)은 표지·가로 이미지가 모두 404 였습니다.
 * 이 스크립트가 Steam 의 IStoreBrowseService/GetItems (API 키 불필요, 100개씩 조회)로 "정확한 주소"를 받고,
 * 예전 규칙의 주소가 실제로 404 인 것만 data/catalog/images.js 에 저장합니다. (해시 주소를 쓰면서도 예전 주소가 아직 되는 게임은 제외 → 파일이 작음)
 * 사이트(game-service.js 의 steamCover/steamArt)가 이 파일을 우선 씁니다.
 *   실행: node scripts/fetch-images.mjs          (Node 18+, 외부 패키지 없음, 1~2분)
 *   결과: data/catalog/images.js   (window.GameFinder.imageData = { updatedAt, map: { appid: { t, c, h, r, s } } })
 *         t = 주소 뒤에 붙는 ?t= 값, c = 세로 표지(600x900), h = 가로 이미지(header), r = 와이드 키아트(library_hero), s = 작은 캡슐(231x87)
 *         c·h·r·s 는 "…/steam/apps/<번호>/" 뒤의 경로(해시/파일명)만 저장. 전체 주소 = IMAGE_BASE + 번호 + '/' + 경로 + '?t=' + t
 *
 * 대상: 카탈로그 게임 + 인기 차트 + 편집 선정 국내 인기작 + data/steam 의 게임 (사이트에 이미지가 나오는 번호를 아는 게임들).
 *       그 밖의 게임(CheapShark 목록 등)은 CheapShark 가 주는 작은 캡슐(thumb)이 대체 이미지로 쓰입니다.
 * 이 파일은 지금 상태의 스냅샷이므로 새 게임이 늘면(카탈로그·차트 갱신 뒤) 다시 실행하세요.
 */
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'catalog', 'images.js');
const UA = 'GameFinder-portfolio/1.0 (static site data refresh)';
const BATCH = 100;
const KR_APP_IDS = ['578080', '1599340', '582660', '216150', '495910'];
const DEFAULT = { c: 'library_600x900.jpg', h: 'header.jpg', r: 'library_hero.jpg' };    // 예전 규칙의 파일 이름
const OLD_BASE = 'https://cdn.cloudflare.steamstatic.com/steam/apps/';
const POOL = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function readJson(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } }

async function candidates() {
  const ids = new Set(KR_APP_IDS);
  (await readJson(path.join(ROOT, 'data', 'catalog', 'known.json'), [])).forEach((r) => r && !r.skip && ids.add(String(r.id)));
  ((await readJson(path.join(ROOT, 'data', 'charts', 'steam-most-played.json'), {})).items || []).forEach((i) => ids.add(String(i.appid)));
  try { for (const f of await readdir(path.join(ROOT, 'data', 'steam'))) if (/^\d+\.json$/.test(f)) ids.add(f.replace('.json', '')); } catch { /* 없으면 건너뜀 */ }
  return [...ids];
}

async function getItems(ids) {
  const input = { ids: ids.map((id) => ({ appid: Number(id) })), context: { language: 'english', country_code: 'US' }, data_request: { include_assets: true } };
  const url = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' + encodeURIComponent(JSON.stringify(input));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).response.store_items || [];
}

// 예전 규칙의 주소가 지금도 열리는지 (HEAD). 동시에 POOL 개씩.
async function isOk(url) {
  try { return (await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } })).ok; } catch { return false; }
}
async function pool(tasks, size) {
  const out = new Array(tasks.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); } }));
  return out;
}

async function main() {
  const ids = await candidates();
  console.log(`대상 ${ids.length}개 게임`);
  const found = {};      // appid → { t, c, h, r, s } (해시 주소를 쓰는 항목)
  let checked = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const items = await getItems(ids.slice(i, i + BATCH));
    for (const it of items) {
      const a = it.assets;
      if (!a || !a.asset_url_format) continue;
      checked++;
      const t = (a.asset_url_format.match(/\?t=(\d+)/) || [])[1] || '';
      const e = { t };
      if (a.library_capsule && a.library_capsule !== DEFAULT.c) e.c = a.library_capsule;
      if (a.header && a.header !== DEFAULT.h) e.h = a.header;
      if (a.library_hero && a.library_hero !== DEFAULT.r) e.r = a.library_hero;
      if (a.small_capsule) e.s = a.small_capsule;
      if (e.c || e.h || e.r) found[String(it.appid)] = e;
    }
    await sleep(800);
  }
  // 예전 주소가 지금도 열리는 항목은 빼고, 404 인 것만 남김
  const entries = Object.entries(found);
  console.log(`해시 주소를 쓰는 게임 ${entries.length}개 — 예전 주소가 실제로 열리는지 확인 중…`);
  const tasks = [];
  entries.forEach(([id, e]) => ['c', 'h', 'r'].forEach((k) => { if (e[k]) tasks.push(async () => [id, k, await isOk(OLD_BASE + id + '/' + DEFAULT[k])]); }));
  const results = await pool(tasks, POOL);
  const map = {};
  entries.forEach(([id, e]) => {
    const keep = { t: e.t };
    ['c', 'h', 'r'].forEach((k) => { const r = results.find((x) => x[0] === id && x[1] === k); if (e[k] && r && !r[2]) keep[k] = e[k]; });
    if (keep.c || keep.h || keep.r) { if (e.s) keep.s = e.s; map[id] = keep; }
  });
  const body = JSON.stringify({ updatedAt: new Date().toISOString(), map });
  await writeFile(OUT, '// 자동 생성 파일 — scripts/fetch-images.mjs 가 만듭니다(Steam 이미지의 정확한 주소). 직접 고치지 마세요.\n(window.GameFinder = window.GameFinder || {}).imageData = ' + body + ';\n', 'utf8');
  const n = (k) => Object.values(map).filter((e) => e[k]).length;
  console.log(`완료: 조회한 게임 ${checked}개 중 예전 주소가 404 라서 새 주소가 필요한 게임 ${Object.keys(map).length}개 (표지 ${n('c')}, 가로 ${n('h')}, 키아트 ${n('r')}) → ${path.relative(ROOT, OUT)} (${Math.round(body.length / 1024)}KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
