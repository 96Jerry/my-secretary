// 제목 맞추기(네이버 연결·오타 찾기)와 붙여넣기 해석. DOM을 쓰지 않아 node --test로 검증한다
import { ALIASES } from './labels.js';

export const norm = (t) => t.replace(/\s+/g, '').toLowerCase();
export const naverUrl = (id) => `https://comic.naver.com/webtoon/list?titleId=${id}`;

// 주소 도메인으로 플랫폼을 알아본다. 링크 문구도 플랫폼 칸이 아니라 주소 기준으로 정한다
const PLATFORM_HOSTS = [
  [/(^|\.)comic\.naver\.com$/, 'naver'],
  [/(^|\.)webtoon\.kakao\.com$/, 'kakaowebtoon'],
  [/(^|\.)page\.kakao\.com$/, 'kakaopage'],
  [/(^|\.)ridibooks\.com$|(^|\.)ridi\.com$/, 'ridi'],
  [/(^|\.)lezhin\.com$/, 'lezhin'],
  [/(^|\.)bomtoon\.com$/, 'bomtoon'],
];

export function platformFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return PLATFORM_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
  } catch { return null; }
}

// 서버와 같은 규칙: comic.naver.com 주소의 titleId
export function naverIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)comic\.naver\.com$/.test(u.hostname)) return null;
    const id = Number(u.searchParams.get('titleId'));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}

export function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 공백·대소문자를 무시하고 똑같은 제목
export const sameTitle = (title, candidates) => candidates.find((c) => norm(c) === norm(title)) ?? null;

// 정확히 같지는 않지만 몇 글자만 다른 제목. 오타 후보로 보여준다
export function similarTitles(title, candidates, limit = 3) {
  const k = norm(title);
  if (!k) return [];
  const max = Math.max(1, Math.floor(k.length / 3));
  return candidates
    .map((c) => ({ c, d: editDistance(k, norm(c)) }))
    .filter((x) => x.d > 0 && x.d <= max)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.c);
}

// 한 줄에 한 작품. 첫 칸은 제목, 나머지는 순서 상관없이 내용으로 알아본다
export function parseBulk(text) {
  return text.split('\n').map((line, i) => ({ line, n: i + 1 })).filter((x) => x.line.trim()).map(({ line, n }) => {
    const [title, ...rest] = line.split(/\t|\|/).map((s) => s.trim());
    const row = { n, title, platform: 'naver', episode: null, status: 'reading', verdict: null, lastReadAt: null, memo: null, url: null };
    const memo = [];
    let explicit = false;
    for (const cell of rest.filter(Boolean)) {
      const k = norm(cell);
      let m;
      if (/^https?:\/\//i.test(cell)) row.url = cell;
      else if (ALIASES.platform[k]) { row.platform = ALIASES.platform[k]; explicit = true; }
      else if (ALIASES.status[k]) row.status = ALIASES.status[k];
      else if (ALIASES.verdict[k]) row.verdict = ALIASES.verdict[k];
      else if ((m = /^(\d+)화?(까지)?$/.exec(k))) row.episode = Number(m[1]);
      else if ((m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(k))) row.lastReadAt = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      else memo.push(cell);
    }
    row.memo = memo.join(' / ') || null;
    // 플랫폼을 직접 적지 않았으면 주소로 정한다
    if (!explicit && row.url) row.platform = platformFromUrl(row.url) ?? row.platform;
    return row;
  });
}
