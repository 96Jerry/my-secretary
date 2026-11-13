// public/assets/js의 DOM 없는 모듈 테스트. jest(CommonJS 변환)와 달리 브라우저용 ES 모듈을 그대로 실행한다
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ago, pct, shiftDate } from '../../public/assets/js/format.js';
import {
  naverIdFromUrl,
  parseBulk,
  platformFromUrl,
  sameTitle,
  similarTitles,
} from '../../public/assets/js/titles.js';

describe('parseBulk', () => {
  it('첫 칸은 제목, 나머지는 순서와 상관없이 내용으로 알아본다', () => {
    const [row] = parseBulk('화산귀환 | 재밌음 | 2026.3.4 | 1250화까지 | 보는 중 | 카카오페이지 | 그림 좋음');
    assert.deepEqual(row, {
      n: 1, title: '화산귀환', platform: 'kakaopage', episode: 1250, status: 'reading',
      verdict: 'good', lastReadAt: '2026-03-04', memo: '그림 좋음', url: null,
    });
  });

  it('탭으로도 나누고, 빈 줄은 건너뛰되 줄 번호는 원래대로 센다', () => {
    const rows = parseBulk('A\t하차\t최악\n\nB');
    assert.deepEqual(rows.map((r) => [r.n, r.title, r.status, r.verdict]), [
      [1, 'A', 'dropped', 'worst'],
      [3, 'B', 'reading', null],
    ]);
  });

  it('플랫폼을 안 적으면 주소로 정하고, 직접 적었으면 그 값을 따른다', () => {
    const [byUrl, explicit, none] = parseBulk(
      'A | https://webtoon.kakao.com/content/a/1\nB | 레진 | https://webtoon.kakao.com/content/b/2\nC',
    );
    assert.equal(byUrl.platform, 'kakaowebtoon');
    assert.equal(explicit.platform, 'lezhin');
    assert.equal(none.platform, 'naver');
  });
});

describe('주소 판별', () => {
  it('도메인으로 플랫폼을 알아본다', () => {
    assert.equal(platformFromUrl('https://m.comic.naver.com/webtoon/list?titleId=1'), 'naver');
    assert.equal(platformFromUrl('https://page.kakao.com/content/1'), 'kakaopage');
    assert.equal(platformFromUrl('https://ridibooks.com/books/1'), 'ridi');
    assert.equal(platformFromUrl('https://evilcomic.naver.com.example/x'), null);
    assert.equal(platformFromUrl('not a url'), null);
  });

  it('네이버 주소에서만 titleId를 뽑는다', () => {
    assert.equal(naverIdFromUrl('https://comic.naver.com/webtoon/list?titleId=769209&tab=mon'), 769209);
    assert.equal(naverIdFromUrl('https://example.com/?titleId=1'), null);
    assert.equal(naverIdFromUrl('https://comic.naver.com/webtoon/list'), null);
  });
});

describe('제목 맞추기', () => {
  const titles = ['화산귀환', '나 혼자 만렙 뉴비', '외모지상주의', '김부장'];

  it('공백·대소문자만 다르면 같은 제목이다', () => {
    assert.equal(sameTitle('나혼자 만렙뉴비', titles), '나 혼자 만렙 뉴비');
    assert.equal(sameTitle('화산귀한', titles), null);
  });

  it('몇 글자만 다른 제목을 오타 후보로 고르고, 같은 제목은 후보에서 뺀다', () => {
    assert.deepEqual(similarTitles('화산귀한', titles), ['화산귀환']);
    assert.deepEqual(similarTitles('외모지상주이', titles), ['외모지상주의']);
    assert.deepEqual(similarTitles('화산귀환', titles), []);
    assert.deepEqual(similarTitles('전혀 다른 작품', titles), []);
  });
});

describe('format', () => {
  it('ago는 일·개월·년 단위로 말한다', () => {
    const today = '2026-11-13';
    assert.equal(ago(null, today), '날짜 모름');
    assert.equal(ago('2026-11-13', today), '오늘');
    assert.equal(ago('2026-11-10', today), '3일 전');
    assert.equal(ago('2026-08-01', today), '3개월 전');
    assert.equal(ago('2024-11-01', today), '2년 전');
  });

  it('shiftDate는 월을 넘겨도 맞게 뺀다', () => {
    assert.equal(shiftDate('2026-03-01', 1), '2026-02-28');
  });

  it('pct는 1% 미만이면 소수 둘째 자리까지 보인다', () => {
    assert.equal(pct(0.5), '+50.0%');
    assert.equal(pct(0.0005), '+0.05%');
    assert.equal(pct(-0.2), '-20.0%');
  });
});
