// 순위·급상승 작품을 펼치면 날짜별 찜 수 추이를 그린다
import { getJson } from './api.js';
import { el } from './dom.js';
import { fmt, signed } from './format.js';
import { naverUrl } from './titles.js';

export function webtoonDetail(w) {
  const box = el('div', { class: 'chart' }, '추이 불러오는 중…');
  getJson(`/webtoons/ranking/${w.titleId}/history`)
    .then((points) => box.replaceChildren(chart(points)))
    .catch((e) => { box.textContent = e.message; });
  return el('div', { class: 'detail' },
    w.thumbnailUrl ? el('img', { src: w.thumbnailUrl, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' }) : el('span'),
    el('div', { class: 'info' },
      w.author ? el('div', {}, w.author) : null,
      el('div', {}, `${w.genreName} · 찜 ${fmt.format(w.favoriteCount)}`),
      el('a', { href: naverUrl(w.titleId), target: '_blank', rel: 'noopener' }, '네이버 웹툰에서 보기 ↗')),
    box);
}

function chart(points) {
  if (points.length < 2) return el('span', { class: 'info' }, '추이를 그리려면 이틀치 이상 필요합니다.');
  const W = 600, H = 170, L = 64, R = 12, T = 12, B = 26;
  const ys = points.map((p) => p.favoriteCount);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const ns = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  const first = points[0], last = points.at(-1);
  svg.setAttribute('aria-label', `${first.snapshotDate} ${fmt.format(first.favoriteCount)}에서 ${last.snapshotDate} ${fmt.format(last.favoriteCount)}`);
  for (const v of [hi, (hi + lo) / 2, lo]) {
    svg.append(s('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    svg.append(s('text', { class: 'axis', x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmt.format(Math.round(v))));
  }
  svg.append(s('text', { class: 'axis', x: L, y: H - 6 }, first.snapshotDate));
  svg.append(s('text', { class: 'axis', x: W - R, y: H - 6, 'text-anchor': 'end' }, last.snapshotDate));
  svg.append(s('polyline', { class: 'line', points: points.map((p, i) => `${x(i)},${y(p.favoriteCount)}`).join(' ') }));
  points.forEach((p, i) => {
    const dot = s('circle', { class: 'dot', cx: x(i), cy: y(p.favoriteCount), r: points.length > 40 ? 1.5 : 3 });
    dot.append(s('title', {}, `${p.snapshotDate}: ${fmt.format(p.favoriteCount)}` + (i ? ` (${signed(p.favoriteCount - points[i - 1].favoriteCount)})` : '')));
    svg.append(dot);
  });
  const days = (Date.parse(last.snapshotDate) - Date.parse(first.snapshotDate)) / 86400000;
  const total = last.favoriteCount - first.favoriteCount;
  return el('div', {}, svg, el('div', { class: 'info' },
    `${days}일간 ${signed(total)} · 하루 평균 ${signed(Math.round(total / days))}`));
}
