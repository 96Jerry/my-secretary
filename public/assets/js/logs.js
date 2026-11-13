// 내 기록 탭: 목록, 입력 폼, 붙여넣기 일괄 등록
import { getJson, send } from './api.js';
import { $, el, select, showError } from './dom.js';
import { ago, fmt, todayKst } from './format.js';
import { PLATFORMS, STATUSES, VERDICT_SHORT, VERDICTS } from './labels.js';
import { renderList } from './list.js';
import { linkLabel, linkOf, naverNameById, naverTitles, rankById, render, state } from './state.js';
import { naverIdFromUrl, parseBulk, platformFromUrl, sameTitle, similarTitles } from './titles.js';

const LOGS_URL = '/webtoons/logs';

export async function loadLogs() {
  state.logs = await getJson(LOGS_URL);
  render();
}

export function renderLogs() {
  if (!state.logs) {
    $('list').replaceChildren(el('li', { class: 'empty' }, '불러오는 중…'));
    return;
  }
  const counts = {};
  for (const l of state.logs) counts[l.status] = (counts[l.status] ?? 0) + 1;
  const chips = [['', '전체', state.logs.length], ...Object.entries(STATUSES).map(([k, v]) => [k, v, counts[k] ?? 0])];
  $('logStatuses').replaceChildren(...chips.map(([k, label, n]) => el('button', {
    'aria-pressed': String(state.logStatus === k),
    onclick: () => { state.logStatus = k; render(); },
  }, label, el('small', {}, n))));

  const q = state.query.trim().toLowerCase();
  const byDate = (dir) => (a, b) => {
    // 날짜를 모르는 기록은 항상 뒤로
    if (!a.lastReadAt || !b.lastReadAt) return (a.lastReadAt ? -1 : 0) + (b.lastReadAt ? 1 : 0);
    return dir * a.lastReadAt.localeCompare(b.lastReadAt);
  };
  const sorters = {
    stale: byDate(1),
    recent: byDate(-1),
    unread: (a, b) => (b.unread ?? -1) - (a.unread ?? -1),
    title: (a, b) => a.title.localeCompare(b.title, 'ko'),
  };
  const rows = state.logs
    .filter((l) => !state.logStatus || l.status === state.logStatus)
    .filter((l) => !q || l.title.toLowerCase().includes(q) || (l.memo ?? '').toLowerCase().includes(q))
    .sort(sorters[state.logSort]);

  const ranks = rankById();
  renderList(rows, (l) => [
    el('span', { class: 'title' }, l.title,
      el('span', { class: 'sub' }, PLATFORMS[l.platform]),
      ranks.get(l.naverTitleId) ? el('span', { class: 'sub' }, `찜 ${ranks.get(l.naverTitleId).rank}위`) : null,
      l.platform === 'naver' && !l.naverTitleId ? el('span', { class: 'badge rest', title: '제목이 네이버 연재 목록과 다르거나 완결작입니다. 수정에서 링크에 네이버 주소를 넣으면 연결됩니다.' }, '순위 미연결') : null,
      el('span', { class: 'badge ' + (l.status === 'dropped' ? 'warn' : 'mine') }, STATUSES[l.status]),
      l.verdict ? el('span', { class: 'badge ' + (l.verdict === 'bad' || l.verdict === 'worst' ? 'warn' : 'new') }, VERDICT_SHORT[l.verdict]) : null),
    el('span', { class: 'num' },
      el('b', {}, l.episode !== null ? `${fmt.format(l.episode)}화` : '–'),
      el('small', { class: l.unread ? 'up' : '' }, l.unread ? `${l.unread}화 안 봄 · ${ago(l.lastReadAt)}` : ago(l.lastReadAt))),
  ], state.logs.length ? '조건에 맞는 기록이 없습니다.' : '아직 기록이 없습니다. "+ 기록 추가"나 "목록 붙여넣기"로 시작하세요.',
  { key: (l) => l.id, expand: logDetail, rowClass: 'row log' });
}

function logDetail(l) {
  const timeline = el('ol', { class: 'timeline' }, el('li', {}, '이력 불러오는 중…'));
  getJson(`${LOGS_URL}/${l.id}/history`).then((hs) => timeline.replaceChildren(...hs.slice().reverse().map((h) => el('li', {},
    `${h.readAt ?? '날짜 모름'} · ${STATUSES[h.status]}` + (h.episode !== null ? ` · ${h.episode}화` : '') + (h.verdict ? ` · ${VERDICT_SHORT[h.verdict]}` : ''))))).catch((e) => { timeline.textContent = e.message; });
  const r = rankById().get(l.naverTitleId);
  return el('div', { class: 'detail single' },
    el('div', { class: 'info' },
      r ? el('div', {}, `찜 순위 ${r.rank}위 · 찜 ${fmt.format(r.favoriteCount)} (${state.ranking.snapshotDate} 기준)`) : null,
      l.latestEpisode !== null ? el('div', {},
        `네이버에 공개된 최신 회차 ${l.latestEpisode}화` + (l.latestPublishedAt ? ` (${l.latestPublishedAt} 공개)` : '') +
        (l.episode !== null ? ` · 나는 ${l.episode}화까지 봄` + (l.unread ? ` → ${l.unread}화 안 봄` : ' → 다 따라잡음') : '')) : null,
      l.memo ? el('div', { class: 'memo' }, l.memo) : null,
      linkOf(l) ? el('a', { href: linkOf(l), target: '_blank', rel: 'noopener' }, linkLabel(l)) : null),
    timeline,
    el('div', { class: 'actions' },
      el('button', { onclick: () => openPanel({ mode: 'edit', log: l }) }, '수정'),
      el('button', { class: 'danger', onclick: () => removeLog(l) }, '삭제')));
}

async function removeLog(l) {
  if (!confirm(`"${l.title}" 기록과 이력을 모두 지울까요?`)) return;
  try {
    await send('DELETE', `${LOGS_URL}/${l.id}`);
    state.open = null;
    await loadLogs();
  } catch (e) { showError(e); }
}

export function openPanel(panel) {
  state.panel = panel;
  renderLogPanel();
  if (panel?.mode === 'edit' && panel.log) scrollTo({ top: 0, behavior: 'smooth' });
}

// 입력 중인 값이 날아가지 않도록 render()와 따로, 패널을 열고 닫을 때만 다시 그린다
function renderLogPanel() {
  const p = state.panel;
  if (!p) { $('logPanel').replaceChildren(); return; }
  if (p.mode === 'bulk') { $('logPanel').replaceChildren(bulkPanel(p)); return; }

  const l = p.log ?? {};
  const isNew = !l.id;
  const field = (label, input, wide) => el('label', wide ? { class: 'wide' } : {}, label, input);
  const title = el('input', { name: 'title', list: 'naverTitles', required: '', value: l.title ?? '', autocomplete: 'off' });
  const episode = el('input', { name: 'episode', type: 'number', min: '0', value: l.episode ?? '' });
  const date = el('input', { name: 'lastReadAt', type: 'date', value: isNew ? todayKst() : (l.lastReadAt ?? '') });
  const memo = el('textarea', { name: 'memo', rows: '2' });
  memo.value = l.memo ?? '';
  const url = el('input', { name: 'url', type: 'url', value: l.url ?? '', placeholder: 'https://comic.naver.com/webtoon/list?titleId=…' });
  const platform = select('platform', PLATFORMS, l.platform ?? 'naver');
  const linkStatus = el('div', { class: 'info wide' });
  const error = el('div', { class: 'err' });
  const form = el('form', { class: 'panel' },
    el('b', {}, isNew ? '기록 추가' : `"${l.title}" 수정`),
    el('div', { class: 'fields' },
      field('제목', title, true),
      field('링크 (주소로 플랫폼을 알아봅니다. 네이버 주소면 완결작도 순위와 연결)', url, true),
      linkStatus,
      field('플랫폼', platform),
      field('본 회차', episode),
      field('상태', select('status', STATUSES, l.status ?? 'reading')),
      field('평가', select('verdict', VERDICTS, l.verdict ?? '', '선택 안 함')),
      field('마지막으로 본 날', date),
      field('메모', memo, true)),
    error,
    el('div', { class: 'actions' },
      el('button', { class: 'primary', type: 'submit' }, '저장'),
      el('button', { type: 'button', onclick: () => openPanel(null) }, '취소')));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.episode = body.episode === '' ? null : Number(body.episode);
    // 제목·링크가 그대로면 기존 연결을 유지하고, 바뀌면 서버가 다시 찾게 한다
    body.naverTitleId = !isNew && body.title === l.title && body.url === (l.url ?? '') ? l.naverTitleId : null;
    try {
      await send(isNew ? 'POST' : 'PUT', isNew ? LOGS_URL : `${LOGS_URL}/${l.id}`, body);
      openPanel(null);
      await loadLogs();
    } catch (err) { error.textContent = err.message; }
  };
  // 저장 전에 네이버 순위와 연결되는지 바로 보여준다
  const updateLink = () => {
    const urlPlatform = platformFromUrl(url.value.trim());
    if (urlPlatform) platform.value = urlPlatform;
    const fromUrl = naverIdFromUrl(url.value.trim());
    if (fromUrl) {
      const name = naverNameById().get(fromUrl);
      if (!title.value.trim() && name) title.value = name;
      linkStatus.textContent = `✓ 네이버 작품 #${fromUrl}로 연결합니다` + (name ? ` (${name})` : ' (순위에 없는 완결작 등)');
      return;
    }
    if (platform.value !== 'naver' || !title.value.trim()) { linkStatus.textContent = ''; return; }
    const exact = sameTitle(title.value, naverTitles());
    if (exact) { linkStatus.textContent = `✓ 순위의 "${exact}"와 연결합니다`; return; }
    if (!isNew && title.value === l.title && l.naverTitleId) { linkStatus.textContent = '✓ 연결되어 있습니다'; return; }
    const similar = similarTitles(title.value, naverTitles());
    linkStatus.replaceChildren('✗ 네이버 연재 목록에서 못 찾았습니다. ',
      ...(similar.length ? ['혹시: ', ...similar.map((c) => el('button', { type: 'button', class: 'suggest', onclick: () => { title.value = c; updateLink(); } }, c))] : []),
      similar.length ? '' : '완결작이면 링크에 네이버 주소를 넣어 주세요.');
  };
  title.oninput = updateLink;
  url.oninput = updateLink;
  platform.onchange = updateLink;
  updateLink();
  $('logPanel').replaceChildren(form);
  if (isNew) title.focus();
}

function bulkPanel(p) {
  const area = el('textarea', { rows: '8', placeholder: '화산귀환 | 네이버 | 1250화 | 보는 중 | 재밌음 | 2026-11-10\n전지적 독자 시점 | 네이버 | 완독 | 인생작\n어떤 작품 | 카카오페이지 | 12화 | 하차 | 최악 | 그림체가 안 맞음' });
  area.value = p.text ?? '';
  const preview = () => { p.text = area.value; p.rows = parseBulk(area.value); p.error = ''; renderLogPanel(); };
  const children = [
    el('b', {}, '목록 붙여넣기'),
    el('div', { class: 'info' }, '한 줄에 한 작품씩, 칸은 | 또는 탭(엑셀·시트에서 복사)으로 나눕니다. 첫 칸은 제목이고, 나머지(플랫폼·회차·상태·평가·날짜·링크)는 순서 상관없이 알아봅니다. 알아보지 못한 칸은 메모가 됩니다. 플랫폼을 안 적으면 네이버로, 상태를 안 적으면 보는 중으로 넣습니다. 이미 있는 작품은 덮어씁니다.'),
    area,
    el('div', { class: 'actions' },
      el('button', { type: 'button', onclick: preview }, '미리보기'),
      p.rows?.length ? el('button', { class: 'primary', type: 'button', onclick: () => saveBulk(p) }, `${p.rows.length}개 저장`) : null,
      el('button', { type: 'button', onclick: () => openPanel(null) }, '닫기')),
  ];
  if (p.error) children.push(el('div', { class: 'err' }, p.error));
  if (p.rows?.length) {
    children.push(el('div', { class: 'scroll-x' }, el('table', { class: 'preview' },
      el('tr', {}, ...['줄', '제목', '플랫폼', '회차', '상태', '평가', '날짜', '메모', '확인'].map((h) => el('th', {}, h))),
      ...p.rows.map((r) => {
        const note = bulkNote(r);
        return el('tr', {}, ...[r.n, r.title, PLATFORMS[r.platform], r.episode ?? '', STATUSES[r.status], r.verdict ? VERDICT_SHORT[r.verdict] : '', r.lastReadAt ?? '', r.memo ?? ''].map((v) => el('td', {}, String(v))),
          el('td', { class: note.warn ? 'err' : 'info' }, note.text));
      }))));
  }
  return el('div', { class: 'panel' }, ...children);
}

// 저장하면 어떻게 되는지 미리 알려 준다. 오타로 다른 작품이 되는 경우를 잡는 게 목적
function bulkNote(r) {
  const mine = (state.logs ?? []).filter((l) => l.platform === r.platform).map((l) => l.title);
  // 서버도 띄어쓰기·대소문자를 무시하고 같은 작품으로 본다
  const existing = sameTitle(r.title, mine);
  if (existing) return { text: existing === r.title ? '기존 기록 덮어씀' : `기존 "${existing}" 덮어씀 (띄어쓰기 차이)` };
  const nearMine = similarTitles(r.title, mine, 1)[0];
  if (nearMine) return { warn: true, text: `기존 "${nearMine}"와 비슷 — 오타면 새 기록이 따로 생깁니다` };
  if (r.platform !== 'naver') return { text: '새 기록' };
  if (r.url && naverIdFromUrl(r.url)) return { text: '새 기록 · 주소로 순위 연결' };
  const exact = sameTitle(r.title, naverTitles());
  if (exact) return { text: '새 기록 · 순위 연결' };
  const near = similarTitles(r.title, naverTitles());
  return { warn: true, text: near.length ? `네이버 목록에 없음 — 혹시: ${near.join(', ')}` : '네이버 연재 목록에 없음 (완결작이면 주소를 붙여 주세요)' };
}

async function saveBulk(p) {
  try {
    const r = await send('POST', `${LOGS_URL}/import`, p.rows.map(({ n, ...row }) => row));
    $('status').textContent = `새로 ${r.created}개, 덮어쓰기 ${r.updated}개 저장했습니다.`;
    openPanel(null);
    await loadLogs();
  } catch (e) {
    p.error = e.message;
    renderLogPanel();
  }
}
