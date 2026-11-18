import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULTS, parseRoute, routeOf } from '../../public/assets/js/route.js';

const state = (over) => ({ ...DEFAULTS, ...over });

describe('route', () => {
  it('빈 주소나 모르는 주소는 찜 순위 기본 화면', () => {
    assert.deepEqual(parseRoute(''), DEFAULTS);
    assert.equal(parseRoute('#/nope').view, 'ranking');
    assert.equal(parseRoute('#/webtoon').view, 'ranking');
  });

  it('기본값은 주소에서 빠진다', () => {
    assert.equal(routeOf(state({})), '#/webtoon/ranking');
    assert.equal(routeOf(state({ view: 'games' })), '#/games');
  });

  it('화면별 상태가 주소를 거쳐 그대로 돌아온다', () => {
    const cases = [
      state({ view: 'ranking', genre: 'FANTASY', desc: false, query: '화산' }),
      state({ view: 'movers', mode: 'rate', preset: 3 }),
      state({ view: 'movers', preset: null, from: '2026-11-01', to: '2026-11-10' }),
      state({ view: 'logs', logStatus: 'dropped', logSort: 'recent' }),
      state({ view: 'games', gameDays: null }),
      state({ view: 'games', gameDays: 30 }),
    ];
    for (const s of cases) assert.deepEqual(parseRoute(routeOf(s)), s, routeOf(s));
  });

  it('형식이 틀린 값은 버리고 기본값을 쓴다', () => {
    const s = parseRoute('#/webtoon/movers?mode=hack&from=2026-1-1&to=x&preset=9&genre=<b>');
    assert.equal(s.mode, 'delta');
    assert.equal(s.preset, 1);
    assert.equal(s.from, '');
    assert.equal(s.genre, '');
    assert.equal(parseRoute('#/games?days=5').gameDays, 7);
    assert.equal(parseRoute('#/webtoon/logs?status=toString').logStatus, '');
  });
});
