// 급상승 탭
import { getJson } from './api.js';
import { $, el, showError } from './dom.js';
import { webtoonDetail } from './detail.js';
import { fmt, pct, shiftDate, signed } from './format.js';
import { matches, renderList, titleCell } from './list.js';
import { render, saveMin, state } from './state.js';

const PRESETS = [{ label: '1일', days: 1 }, { label: '7일', days: 7 }, { label: '30일', days: 30 }, { label: '전체', days: null }];
const MODES = [
  { key: 'delta', label: '증가량' },
  { key: 'rate', label: '증가율' },
  { key: 'drop', label: '감소' },
  { key: 'entered', label: '신규 진입' },
  { key: 'exited', label: '연재 목록 이탈' },
];

export async function loadMovers() {
  const q = new URLSearchParams();
  if (state.from) q.set('from', state.from);
  if (state.to) q.set('to', state.to);
  state.movers = await getJson('/webtoons/ranking/movers?' + q);
  // 서버가 실제 스냅샷 날짜로 맞춰 준 값을 선택 상자에 반영한다
  state.from = state.movers.fromDate ?? '';
  state.to = state.movers.toDate ?? '';
  render();
}

export function applyPreset(i) {
  state.preset = i;
  const dates = state.movers?.dates ?? [];
  const latest = dates.at(-1);
  if (!latest) return;
  const { days } = PRESETS[i];
  state.to = latest;
  state.from = days === null ? dates[0] : shiftDate(latest, days);
  loadMovers().catch(showError);
}

export function renderMovers() {
  const m = state.movers;
  $('presets').replaceChildren(...PRESETS.map((p, i) => el('button', {
    'aria-pressed': String(state.preset === i),
    onclick: () => applyPreset(i),
  }, p.label)));
  const options = (sel, value) => sel.replaceChildren(...(m?.dates ?? []).map((d) => {
    const o = el('option', { value: d }, d);
    o.selected = d === value;
    return o;
  }));
  options($('from'), state.from);
  options($('to'), state.to);

  $('modes').replaceChildren(...MODES.map((x) => el('button', {
    'aria-pressed': String(state.mode === x.key),
    onclick: () => { state.mode = x.key; render(); },
  }, x.label)));

  const hint = $('modeHint');
  if (state.mode === 'rate') {
    const input = el('input', { type: 'number', min: '0', step: '10000', value: String(state.minFavorites), 'aria-label': '최소 찜 수' });
    input.onchange = () => { state.minFavorites = Math.max(0, Number(input.value) || 0); saveMin(state.minFavorites); render(); };
    hint.replaceChildren('시작 시점 찜 ', input, ' 이상만 (찜이 적은 작품은 증가율이 크게 튀어서 거릅니다)');
  } else if (state.mode === 'exited') {
    hint.textContent = '기간 중 연재 목록에서 빠진 작품입니다. 완결, 연재 중단 등이 여기에 들어갑니다.';
  } else {
    hint.textContent = '';
  }

  if (!m || !m.fromDate) {
    renderList([], null, (m?.dates.length ?? 0) < 2 ? '비교하려면 스냅샷이 이틀치 이상 필요합니다.' : '선택한 기간에 비교할 스냅샷이 없습니다.');
    return;
  }

  let rows;
  let numCell;
  if (state.mode === 'entered' || state.mode === 'exited') {
    rows = m[state.mode].filter(matches);
    numCell = (w) => el('span', { class: 'num' }, el('b', {}, fmt.format(w.favoriteCount)));
  } else {
    rows = m.items.filter(matches);
    if (state.mode === 'delta') rows = rows.filter((w) => w.delta > 0).sort((a, b) => b.delta - a.delta);
    if (state.mode === 'drop') rows = rows.filter((w) => w.delta < 0).sort((a, b) => a.delta - b.delta);
    if (state.mode === 'rate') rows = rows.filter((w) => w.rate !== null && w.rate > 0 && w.fromCount >= state.minFavorites).sort((a, b) => b.rate - a.rate);
    const main = (w) => state.mode === 'rate' ? pct(w.rate) : signed(w.delta);
    const side = (w) => state.mode === 'rate' ? signed(w.delta) : (w.rate === null ? '' : pct(w.rate));
    numCell = (w) => el('span', { class: 'num' },
      el('b', { class: w.delta > 0 ? 'up' : 'down' }, main(w)),
      el('small', {}, `${fmt.format(w.fromCount)} → ${fmt.format(w.favoriteCount)} · ${side(w)}`));
  }

  renderList(rows.map((w, i) => ({ ...w, shownRank: i + 1 })), (w) => [
    el('span', { class: 'rank' }, w.shownRank),
    el('span', { class: 'chg' }),
    titleCell(w),
    numCell(w),
  ], '조건에 맞는 작품이 없습니다.', { expand: webtoonDetail });
}
