// 주소 해시(#/webtoon/movers?mode=rate)와 화면 상태를 오간다. 새로고침·뒤로 가기·링크 공유용. DOM을 쓰지 않는다
import { STATUSES } from './labels.js';

// 서버 API(/games 등)와 겹치지 않도록 화면 주소는 해시로만 표현한다
export const PATHS = {
  ranking: '/webtoon/ranking',
  movers: '/webtoon/movers',
  logs: '/webtoon/logs',
  games: '/games',
};
export const SECTION_OF = { ranking: 'webtoon', movers: 'webtoon', logs: 'webtoon', games: 'games' };

const MODES = ['delta', 'rate', 'drop', 'entered', 'exited'];
const LOG_SORTS = ['stale', 'recent', 'unread', 'title'];
const GAME_DAYS = ['1', '7', '30', 'all'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 주소에 값이 없을 때 쓰는 기본값. routeOf는 기본값과 같은 값을 주소에서 뺀다
export const DEFAULTS = {
  view: 'ranking', genre: '', query: '', desc: true,
  mode: 'delta', preset: 1, from: '', to: '',
  logStatus: '', logSort: 'stale', gameDays: 7,
};

/** 해시 → 상태 조각. 모르는 값은 기본값으로 */
export function parseRoute(hash) {
  const [rawPath, query = ''] = String(hash).replace(/^#/, '').split('?');
  const path = rawPath.replace(/\/+$/, '');
  const p = new URLSearchParams(query);
  const view = Object.keys(PATHS).find((v) => PATHS[v] === path) ?? 'ranking';
  const s = { ...DEFAULTS, view };
  const q = p.get('q');
  if (q) s.query = q.slice(0, 100);

  if (view === 'ranking' || view === 'movers') {
    const genre = p.get('genre');
    if (genre && /^[A-Z_]{1,20}$/.test(genre)) s.genre = genre;
  }
  if (view === 'ranking' && p.get('sort') === 'asc') s.desc = false;
  if (view === 'movers') {
    if (MODES.includes(p.get('mode'))) s.mode = p.get('mode');
    const from = p.get('from'), to = p.get('to');
    if (DATE.test(from ?? '') && DATE.test(to ?? '')) {
      Object.assign(s, { preset: null, from, to });
    } else if (['0', '1', '2', '3'].includes(p.get('preset'))) {
      s.preset = Number(p.get('preset'));
    }
  }
  if (view === 'logs') {
    if (Object.hasOwn(STATUSES, p.get('status') ?? '')) s.logStatus = p.get('status');
    if (LOG_SORTS.includes(p.get('sort'))) s.logSort = p.get('sort');
  }
  if (view === 'games' && GAME_DAYS.includes(p.get('days'))) {
    s.gameDays = p.get('days') === 'all' ? null : Number(p.get('days'));
  }
  return s;
}

/** 상태 → 해시. 기본값은 생략해 주소를 짧게 둔다 */
export function routeOf(state) {
  const p = new URLSearchParams();
  const v = state.view;
  if (v === 'ranking' || v === 'movers') {
    if (state.genre) p.set('genre', state.genre);
  }
  if (v === 'ranking' && !state.desc) p.set('sort', 'asc');
  if (v === 'movers') {
    if (state.mode !== DEFAULTS.mode) p.set('mode', state.mode);
    if (state.preset === null) {
      if (state.from && state.to) { p.set('from', state.from); p.set('to', state.to); }
    } else if (state.preset !== DEFAULTS.preset) {
      p.set('preset', String(state.preset));
    }
  }
  if (v === 'logs') {
    if (state.logStatus) p.set('status', state.logStatus);
    if (state.logSort !== DEFAULTS.logSort) p.set('sort', state.logSort);
  }
  if (v === 'games' && state.gameDays !== DEFAULTS.gameDays) {
    p.set('days', state.gameDays === null ? 'all' : String(state.gameDays));
  }
  if (v !== 'games' && state.query.trim()) p.set('q', state.query.trim());
  const qs = p.toString();
  return '#' + PATHS[v] + (qs ? '?' + qs : '');
}
