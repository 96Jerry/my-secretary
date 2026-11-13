// 순위 탭
import { getJson } from './api.js';
import { $, el } from './dom.js';
import { webtoonDetail } from './detail.js';
import { fmt, signed } from './format.js';
import { matches, renderList, titleCell } from './list.js';
import { render, state } from './state.js';

export async function loadRanking() {
  state.ranking = await getJson('/webtoons/ranking');
  render();
}

function rankChange(w) {
  // 장르 필터 중에는 전체 순위 변동이 헷갈리므로 표시하지 않는다
  if (state.genre || !state.ranking.previousDate) return el('span', { class: 'chg' });
  if (w.previousRank === null) return el('span', { class: 'chg up' }, 'NEW');
  const d = w.previousRank - w.rank;
  if (d === 0) return el('span', { class: 'chg' }, '–');
  return el('span', { class: 'chg ' + (d > 0 ? 'up' : 'down') }, (d > 0 ? '▲' : '▼') + Math.abs(d));
}

export function renderRanking() {
  // 장르 안에서의 순위를 보여주기 위해 필터 후 다시 번호를 매긴다
  let rows = state.ranking.items
    .filter((w) => !state.genre || w.genreCode === state.genre)
    .map((w, i) => ({ ...w, shownRank: state.genre ? i + 1 : w.rank }))
    .filter(matches);
  if (!state.desc) rows = rows.reverse();
  $('sort').textContent = state.desc ? '찜 많은 순 ↓' : '찜 적은 순 ↑';

  renderList(rows, (w) => {
    const daily = w.previousFavoriteCount === null ? null : w.favoriteCount - w.previousFavoriteCount;
    return [
      el('span', { class: 'rank' }, w.shownRank),
      rankChange(w),
      titleCell(w),
      el('span', { class: 'num' }, el('b', {}, fmt.format(w.favoriteCount)),
        daily !== null ? el('small', { class: daily > 0 ? 'up' : daily < 0 ? 'down' : '' }, signed(daily)) : null),
    ];
  }, state.ranking.snapshotDate ? '조건에 맞는 작품이 없습니다.' : '데이터 없음', { expand: webtoonDetail });
}
