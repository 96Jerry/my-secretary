// 순위·급상승·내 기록이 함께 쓰는 목록 그리기
import { $, el } from './dom.js';
import { STATUSES } from './labels.js';
import { logByNaverId, render, state } from './state.js';

export function renderList(rows, cells, emptyText, { key = (w) => w.titleId, expand, rowClass = 'row' } = {}) {
  if (rows.length === 0) {
    $('list').replaceChildren(el('li', { class: 'empty' }, emptyText));
    return;
  }
  $('list').replaceChildren(...rows.map((w) => {
    const k = key(w);
    const li = el('li', {}, el('button', {
      class: rowClass, 'aria-expanded': String(state.open === k),
      onclick: () => { state.open = state.open === k ? null : k; render(); },
    }, ...cells(w)));
    if (state.open === k) li.append(expand(w));
    return li;
  }));
}

export const matches = (w) => {
  const q = state.query.trim().toLowerCase();
  const seen = state.mine === 'all' || !state.logs ? null : logByNaverId().has(w.titleId);
  return (!state.genre || w.genreCode === state.genre) &&
    (seen === null || (state.mine === 'only') === seen) &&
    (!q || w.titleName.toLowerCase().includes(q) || (w.author ?? '').toLowerCase().includes(q));
};

// 추천 목록에서 내가 이미 본 작품임을 상태로만 알린다. 하차는 눈에 띄게
function mineBadge(log) {
  if (!log) return null;
  return el('span', { class: 'badge ' + (log.status === 'dropped' ? 'warn' : 'mine') }, STATUSES[log.status]);
}

export function titleCell(w) {
  return el('span', { class: 'title' },
    w.titleName,
    mineBadge(logByNaverId().get(w.titleId)),
    !state.genre ? el('span', { class: 'sub' }, w.genreName) : null,
    w.isNew ? el('span', { class: 'badge new' }, '신작') : null,
    w.isRest ? el('span', { class: 'badge rest' }, '휴재') : null,
    w.starScore ? el('span', { class: 'sub' }, '★' + w.starScore.toFixed(2)) : null);
}
