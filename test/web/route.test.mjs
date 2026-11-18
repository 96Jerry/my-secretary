import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULTS, parseRoute, routeOf, titleOf, VIEWS } from '../../public/assets/js/route.js';

const state = (over) => ({ ...DEFAULTS, ...over });

describe('route', () => {
  it('영역/종류/탭 구조로 주소를 만든다', () => {
    assert.equal(VIEWS.ranking.path, '/content/webtoon/ranking');
    assert.equal(VIEWS.playtime.path, '/game/playtime');
    assert.equal(titleOf('movers'), '웹툰 급상승');
    assert.equal(titleOf('playtime'), '게임 플레이 시간');
  });

  it('빈 주소나 모르는 주소는 웹툰 찜 순위', () => {
    assert.deepEqual(parseRoute(''), DEFAULTS);
    assert.equal(parseRoute('#/nope').view, 'ranking');
  });

  it('영역·종류까지만 적은 주소와 예전 주소도 받아 준다', () => {
    assert.equal(parseRoute('#/content').view, 'ranking');
    assert.equal(parseRoute('#/content/webtoon/').view, 'ranking');
    assert.equal(parseRoute('#/game').view, 'playtime');
    assert.equal(parseRoute('#/webtoon/logs?sort=recent').logSort, 'recent');
    assert.equal(parseRoute('#/games?days=all').gameDays, null);
  });

  it('기본값은 주소에서 빠진다', () => {
    assert.equal(routeOf(state({})), '#/content/webtoon/ranking');
    assert.equal(routeOf(state({ view: 'playtime' })), '#/game/playtime');
  });

  it('화면별 상태가 주소를 거쳐 그대로 돌아온다', () => {
    const cases = [
      state({ view: 'ranking', genre: 'FANTASY', desc: false, query: '화산' }),
      state({ view: 'movers', mode: 'rate', preset: 3 }),
      state({ view: 'movers', preset: null, from: '2026-11-01', to: '2026-11-10' }),
      state({ view: 'logs', logStatus: 'dropped', logSort: 'recent' }),
      state({ view: 'playtime', gameDays: null }),
      state({ view: 'playtime', gameDays: 30 }),
    ];
    for (const s of cases) assert.deepEqual(parseRoute(routeOf(s)), s, routeOf(s));
  });

  it('형식이 틀린 값은 버리고 기본값을 쓴다', () => {
    const s = parseRoute('#/content/webtoon/movers?mode=hack&from=2026-1-1&to=x&preset=9&genre=<b>');
    assert.equal(s.mode, 'delta');
    assert.equal(s.preset, 1);
    assert.equal(s.from, '');
    assert.equal(s.genre, '');
    assert.equal(parseRoute('#/game/playtime?days=5').gameDays, 7);
    assert.equal(parseRoute('#/content/webtoon/logs?status=toString').logStatus, '');
  });
});
