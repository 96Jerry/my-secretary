// 화면 전체가 공유하는 상태. 목록은 한 번 받아 장르·검색·정렬은 브라우저에서 처리한다
import { PLATFORMS } from './labels.js';
import { naverUrl, platformFromUrl } from './titles.js';

// 증가율은 찜 수가 적을수록 크게 튄다. 중앙값(약 6만) 근처로 보수적으로 잡고 화면에서 바꿀 수 있게 한다
const DEFAULT_MIN_FAVORITES = 50000;

function readMin() {
  try { return Number(localStorage.getItem('minFavorites')) || DEFAULT_MIN_FAVORITES; }
  catch { return DEFAULT_MIN_FAVORITES; }
}
export function saveMin(v) { try { localStorage.setItem('minFavorites', String(v)); } catch { /* 저장 못 해도 동작엔 지장 없다 */ } }

// 주소로 복원되는 값(view, genre, mode 등)은 main.js가 시작할 때 route.js로 덮어쓴다
export const state = {
  view: 'ranking', lastWebtoon: 'ranking', ranking: null, movers: null, genre: '', query: '', desc: true,
  mode: 'delta', preset: 1, from: '', to: '', minFavorites: readMin(), open: null,
  logs: null, logStatus: '', logSort: 'stale', mine: 'all',
  games: null, gameDays: 7,
  // null | { mode: 'edit', log } | { mode: 'bulk', text, rows, error }
  panel: null,
};

// 각 화면 모듈이 main.js를 import하지 않고도 다시 그릴 수 있게 render를 주입받는다
let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };
export const render = () => renderFn();

export const logByNaverId = () => new Map((state.logs ?? []).filter((l) => l.naverTitleId).map((l) => [l.naverTitleId, l]));
export const naverTitles = () => state.ranking?.items.map((w) => w.titleName) ?? [];
export const naverNameById = () => new Map(state.ranking?.items.map((w) => [w.titleId, w.titleName]) ?? []);
export const rankById = () => new Map(state.ranking?.items.map((w) => [w.titleId, w]) ?? []);

export const linkOf = (l) => l.url || (l.naverTitleId ? naverUrl(l.naverTitleId) : null);
export function linkLabel(l) {
  const p = l.url ? platformFromUrl(l.url) : 'naver';
  return p ? `${PLATFORMS[p]}에서 보기 ↗` : '작품 페이지 열기 ↗';
}
