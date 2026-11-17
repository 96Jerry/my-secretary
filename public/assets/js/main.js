// 진입점: 공통 영역(헤더·탭·장르 칩)을 그리고 이벤트를 연결한다
import { $, el, showError } from './dom.js';
import { fmt } from './format.js';
import { loadGames, renderGames } from './games.js';
import { loadLogs, openPanel, renderLogs } from './logs.js';
import { applyPreset, loadMovers, renderMovers } from './movers.js';
import { loadRanking, renderRanking } from './ranking.js';
import { setRender, state } from './state.js';

function render() {
  const r = state.ranking;
  if (!r) return;
  $('meta').textContent = r.snapshotDate
    ? `${r.snapshotDate} 기준 · ${fmt.format(r.items.length)}개 작품` + (r.previousDate ? ` · 변동은 ${r.previousDate} 대비` : '')
    : '아직 수집된 데이터가 없습니다. "지금 수집"을 눌러 주세요.';

  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
  $('moverControls').hidden = state.view !== 'movers';
  $('logControls').hidden = state.view !== 'logs';
  $('gameControls').hidden = state.view !== 'games';
  $('genres').hidden = state.view === 'logs' || state.view === 'games';
  $('search').hidden = state.view === 'games';
  $('sort').hidden = state.view !== 'ranking';
  $('mine').hidden = state.view === 'logs' || state.view === 'games' || !state.logs?.length;
  if (!$('naverTitles').childElementCount) {
    $('naverTitles').replaceChildren(...r.items.map((w) => el('option', { value: w.titleName })));
  }

  const chips = [{ code: '', name: '전체', count: r.items.length }, ...r.genres];
  $('genres').replaceChildren(...chips.map((g) => el('button', {
    'aria-pressed': String(g.code === state.genre),
    onclick: () => { state.genre = g.code; render(); },
  }, g.name, el('small', {}, g.count))));

  if (state.view === 'ranking') renderRanking();
  else if (state.view === 'movers') renderMovers();
  else if (state.view === 'logs') renderLogs();
  else renderGames();
}
setRender(render);

document.querySelectorAll('.tabs button').forEach((b) => {
  b.onclick = () => {
    state.view = b.dataset.view;
    state.open = null;
    // 처음엔 날짜 목록부터 받아야 기본 기간(7일)을 계산할 수 있다
    if (state.view === 'movers' && !state.movers) loadMovers().then(() => applyPreset(state.preset)).catch(showError);
    // 플레이 시간은 계속 늘어나므로 탭을 열 때마다 새로 받는다
    if (state.view === 'games') loadGames().catch(showError);
    render();
  };
});
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

loadRanking().catch((e) => { $('meta').textContent = e.message; });
loadLogs().catch(showError);
