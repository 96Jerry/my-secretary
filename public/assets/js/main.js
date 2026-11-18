// 진입점: 공통 영역(메뉴·탭·장르 칩)을 그리고 이벤트와 주소를 연결한다
import { $, el, showError } from './dom.js';
import { fmt } from './format.js';
import { loadGames, renderGames } from './games.js';
import { loadLogs, openPanel, renderLogs } from './logs.js';
import { applyPreset, loadMovers, renderMovers } from './movers.js';
import { loadRanking, renderRanking } from './ranking.js';
import { parseRoute, routeOf, SECTIONS, sectionOf, titleOf, VIEWS } from './route.js';
import { setRender, state } from './state.js';

const ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gamepad: '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>',
};

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

// 영역 메뉴, 종류, 탭을 route.js 구성대로 그린다
function renderNav() {
  const { section, kind } = VIEWS[state.view];
  $('sections').replaceChildren(...SECTIONS.map((s) => el('a', {
    href: '#' + VIEWS[s.kinds[0].tabs[0].view].path,
    'aria-current': String(s === section),
    onclick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      go(state.lastView[s.key] ?? s.kinds[0].tabs[0].view);
    },
  }, icon(s.icon), el('span', {}, s.label))));

  // 종류가 하나뿐이면 고르는 버튼 대신 제목으로 보여 준다
  const kinds = section.kinds.filter((k) => k.key);
  $('kinds').replaceChildren(...(kinds.length > 1
    ? kinds.map((k) => el('button', { 'aria-pressed': String(k === kind), onclick: () => go(k.tabs[0].view) }, k.label))
    : [el('h2', {}, kind.label ?? section.label)]));

  $('tabs').replaceChildren(...kind.tabs.map((t) => el('button', {
    role: 'tab', 'aria-selected': String(t.view === state.view), onclick: () => go(t.view),
  }, t.label)));
}

// 화면 상태를 주소에 반영한다. 탭이 바뀌면 방문 기록을 남겨 뒤로 가기가 되고, 필터만 바뀌면 덮어쓴다
function syncUrl() {
  const hash = routeOf(state);
  if (hash === location.hash) return;
  const replace = location.hash === '' || parseRoute(location.hash).view === state.view;
  history[replace ? 'replaceState' : 'pushState'](null, '', hash);
}

function render() {
  syncUrl();
  const v = state.view;
  state.lastView[sectionOf(v).key] = v;
  document.title = `${titleOf(v)} · My Secretary`;
  renderNav();
  $('rankingBar').hidden = v !== 'ranking' && v !== 'movers';
  $('moverControls').hidden = v !== 'movers';
  $('logControls').hidden = v !== 'logs';
  $('gameControls').hidden = v !== 'playtime';
  $('searchControls').hidden = v === 'playtime';
  $('genres').hidden = v !== 'ranking' && v !== 'movers';
  $('sort').hidden = v !== 'ranking';
  $('mine').hidden = (v !== 'ranking' && v !== 'movers') || !state.logs?.length;
  // 주소에서 복원한 값을 입력칸에도 보여 준다
  if ($('search').value !== state.query) $('search').value = state.query;
  $('logSort').value = state.logSort;
  $('mine').value = state.mine;

  if (v === 'playtime') { renderGames(); return; }

  const r = state.ranking;
  if (!r) return;
  $('meta').textContent = r.snapshotDate
    ? `${r.snapshotDate} 기준 · ${fmt.format(r.items.length)}개 작품` + (r.previousDate ? ` · 변동은 ${r.previousDate} 대비` : '')
    : '아직 수집된 데이터가 없습니다. "지금 수집"을 눌러 주세요.';
  if (!$('naverTitles').childElementCount) {
    $('naverTitles').replaceChildren(...r.items.map((w) => el('option', { value: w.titleName })));
  }

  const chips = [{ code: '', name: '전체', count: r.items.length }, ...r.genres];
  $('genres').replaceChildren(...chips.map((g) => el('button', {
    'aria-pressed': String(g.code === state.genre),
    onclick: () => { state.genre = g.code; render(); },
  }, g.name, el('small', {}, g.count))));

  if (v === 'ranking') renderRanking();
  else if (v === 'movers') renderMovers();
  else renderLogs();
}
setRender(render);

// 화면에 들어올 때 필요한 데이터를 받는다
function enterView() {
  if (state.view === 'movers') {
    // 처음엔 날짜 목록부터 받아야 기간 버튼(7일 등)의 시작일을 계산할 수 있다
    if (state.preset === null) loadMovers().catch(showError);
    else if (state.movers) applyPreset(state.preset);
    else loadMovers().then(() => applyPreset(state.preset)).catch(showError);
  }
  // 플레이 시간은 계속 늘어나므로 들어올 때마다 새로 받는다
  if (state.view === 'playtime') loadGames().catch(showError);
}

function go(view) {
  if (view === state.view) return;
  state.view = view;
  state.open = null;
  enterView();
  render();
}

// 주소를 직접 고치거나 뒤로·앞으로 가면 그 주소의 화면으로
function applyUrl() {
  const prev = state.view;
  Object.assign(state, parseRoute(location.hash));
  if (state.view !== prev) state.open = null;
  enterView();
  render();
}
window.addEventListener('popstate', applyUrl);

$('mine').onchange = (e) => { state.mine = e.target.value; render(); };
$('logSort').onchange = (e) => { state.logSort = e.target.value; render(); };
$('addLog').onclick = () => openPanel({ mode: 'edit', log: null });
$('bulkLog').onclick = () => openPanel({ mode: 'bulk', text: '', rows: [] });
$('from').onchange = (e) => { state.from = e.target.value; state.preset = null; loadMovers().catch(showError); };
$('to').onchange = (e) => { state.to = e.target.value; state.preset = null; loadMovers().catch(showError); };
$('search').oninput = (e) => { state.query = e.target.value; render(); };
$('sort').onclick = () => { state.desc = !state.desc; render(); };

$('refresh').onclick = async () => {
  const btn = $('refresh');
  btn.disabled = true;
  btn.textContent = '수집 중…';
  $('status').textContent = '네이버에서 800여 개 작품을 조회하고 있습니다 (30초 안팎).';
  try {
    const res = await fetch('/webtoons/ranking/refresh', { method: 'POST' });
    if (!res.ok) throw new Error(`수집 실패 (HTTP ${res.status})`);
    const r = await res.json();
    $('status').textContent =
      `${fmt.format(r.saved)}개 저장` + (r.failed ? `, 실패 ${r.failed}개` : '') +
      ` · ${(r.elapsedMs / 1000).toFixed(1)}초`;
    state.movers = null;
    await loadRanking();
    if (state.view === 'movers') await loadMovers();
  } catch (e) {
    showError(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '지금 수집';
  }
};

Object.assign(state, parseRoute(location.hash));
enterView();
render();
loadRanking().catch((e) => { $('meta').textContent = e.message; });
loadLogs().catch(showError);
