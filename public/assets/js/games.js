// 게임 탭: 디스코드 상태로 모은 플레이 시간
import { getJson, send } from './api.js';
import { $, el, showError } from './dom.js';
import { ago, duration, timeRange } from './format.js';
import { renderList } from './list.js';
import { render, state } from './state.js';

const PRESETS = [{ label: '오늘', days: 1 }, { label: '7일', days: 7 }, { label: '30일', days: 30 }, { label: '전체', days: null }];

let seq = 0;
export async function loadGames() {
  // 기간 버튼과 자동 갱신이 겹치면 마지막 요청 결과만 쓴다
  const mine = ++seq;
  const data = await getJson('/games?days=' + (state.gameDays ?? 'all'));
  if (mine !== seq) return;
  state.games = data;
  render();
}

// 플레이 시간은 계속 늘어나므로, 화면이 보이는 동안 1분마다 새로 받고 다시 보일 때도 바로 받는다
const AUTO_REFRESH_MS = 60_000;
const visible = () => state.view === 'playtime' && document.visibilityState === 'visible';
export function startGameAutoRefresh() {
  setInterval(() => { if (visible()) loadGames().catch(() => {}); }, AUTO_REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (visible()) loadGames().catch(() => {}); });
}

export function renderGames() {
  $('gamePresets').replaceChildren(...PRESETS.map((p) => el('button', {
    'aria-pressed': String(state.gameDays === p.days),
    onclick: () => { state.gameDays = p.days; state.open = null; loadGames().catch(showError); },
  }, p.label)));

  const g = state.games;
  if (!g) {
    $('gameSummary').replaceChildren();
    renderList([], null, '불러오는 중…');
    return;
  }
  $('gameSummary').replaceChildren(summaryPanel(g));

  const total = g.totalSeconds || 1;
  renderList(g.totals, (t) => [
    el('span', { class: 'title' }, t.gameName,
      g.nowPlaying.some((s) => s.gameName === t.gameName) ? el('span', { class: 'badge new' }, '하는 중') : null,
      el('span', { class: 'sub' }, `${t.sessions}회 · 마지막 ${ago(isoDateKst(t.lastPlayedAt))}`)),
    el('span', { class: 'num' },
      el('b', {}, duration(t.seconds)),
      el('small', {}, `${Math.round((t.seconds / total) * 100)}%`)),
  ], g.tracking ? '이 기간에 기록된 게임이 없습니다.' : '게임 기록이 꺼져 있습니다. 서버에 DISCORD_GAME_USER_ID를 설정해 주세요.',
  { key: (t) => t.gameName, expand: gameDetail, rowClass: 'row log' });
}

function summaryPanel(g) {
  const days = g.daily.length || 1;
  return el('div', { class: 'panel' },
    ...g.nowPlaying.map((s) => el('div', {},
      el('span', { class: 'badge new' }, '지금'), ' ',
      el('b', {}, s.gameName), el('span', { class: 'sub' }, `${duration(s.seconds)}째`))),
    el('div', { class: 'info' },
      `총 ${duration(g.totalSeconds)}`,
      days > 1 ? ` · 하루 평균 ${duration(Math.round(g.totalSeconds / days))}` : '',
      g.fromDate ? ` · ${g.fromDate} ~ ${g.toDate}` : ''),
    days > 1 ? el('div', { class: 'chart' }, dailyChart(g.daily)) : null);
}

function gameDetail(t) {
  const sessions = state.games.recent.filter((s) => s.gameName === t.gameName);
  return el('div', { class: 'detail single' },
    el('div', { class: 'info' },
      sessions.length ? el('ol', { class: 'timeline' }, ...sessions.map((s) => el('li', {},
        `${timeRange(s.startedAt, s.endedAt)} · ${duration(s.seconds)} `,
        el('button', { class: 'suggest', title: '잘못 잡힌 기록 지우기', onclick: (e) => { e.stopPropagation(); removeSession(s); } }, '삭제'))))
        : '최근 30개 세션 안에는 이 게임 기록이 없습니다.',
      sessions.length ? el('div', {}, '이 기간 최근 세션 30개 중에서 보여 줍니다.') : null));
}

async function removeSession(s) {
  if (!confirm(`${s.gameName} ${timeRange(s.startedAt, s.endedAt)} 기록을 지울까요?`)) return;
  try {
    await send('DELETE', `/games/sessions/${s.id}`);
    await loadGames();
  } catch (e) { showError(e); }
}

const isoDateKst = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso));

function dailyChart(daily) {
  const W = 600, H = 150, L = 44, R = 8, T = 10, B = 24;
  const max = Math.max(3600, ...daily.map((d) => d.seconds));
  const hours = Math.ceil(max / 3600);
  const bw = (W - L - R) / daily.length;
  const y = (sec) => T + (1 - sec / (hours * 3600)) * (H - T - B);
  const ns = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '일별 플레이 시간' });
  for (const h of [hours, Math.round(hours / 2), 0]) {
    svg.append(s('line', { class: 'grid', x1: L, x2: W - R, y1: y(h * 3600), y2: y(h * 3600) }));
    svg.append(s('text', { class: 'axis', x: L - 6, y: y(h * 3600) + 4, 'text-anchor': 'end' }, `${h}시간`));
  }
  daily.forEach((d, i) => {
    if (!d.seconds) return;
    const bar = s('rect', { class: 'bar', x: L + i * bw + bw * 0.15, width: Math.max(1, bw * 0.7), y: y(d.seconds), height: y(0) - y(d.seconds), rx: Math.min(3, bw * 0.2) });
    const games = Object.entries(d.games).sort((a, b) => b[1] - a[1]).map(([n, sec]) => `${n} ${duration(sec)}`).join(', ');
    bar.append(s('title', {}, `${d.date}: ${duration(d.seconds)} (${games})`));
    svg.append(bar);
  });
  svg.append(s('text', { class: 'axis', x: L, y: H - 6 }, daily[0].date.slice(5)));
  svg.append(s('text', { class: 'axis', x: W - R, y: H - 6, 'text-anchor': 'end' }, daily.at(-1).date.slice(5)));
  return svg;
}
