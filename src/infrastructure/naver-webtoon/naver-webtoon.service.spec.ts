import { Logger } from '@nestjs/common';

// 재시도 백오프 대기는 검증 대상이 아니다. 가짜 타이머는 node:timers/promises에
// 닿지 않으므로 모듈째 대체한다.
jest.mock('node:timers/promises', () => ({
  setTimeout: (): Promise<void> => Promise.resolve(),
}));

import { NaverWebtoonService } from './naver-webtoon.service.js';

function toUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * 네이버 웹툰 API 대역. titleId별로 응답을 순서대로 꺼내 쓰므로
 * 재시도 시나리오(첫 응답 429 → 다음 응답 200)를 표현할 수 있다.
 */
class FakeNaver {
  titleListMap: Record<string, { titleId: number; titleName: string }[]> = {};
  readonly details = new Map<number, Response[]>();
  readonly calls = new Map<number, number>();

  install(): void {
    globalThis.fetch = (input: RequestInfo | URL): Promise<Response> =>
      Promise.resolve(this.respond(toUrl(input)));
  }

  private respond(url: string): Response {
    const target = new URL(url);
    if (target.pathname.endsWith('/titlelist/weekday')) {
      return json({ titleListMap: this.titleListMap });
    }
    const titleId = Number(target.searchParams.get('titleId'));
    this.calls.set(titleId, (this.calls.get(titleId) ?? 0) + 1);
    const queue = this.details.get(titleId) ?? [];
    return queue.length > 1 ? queue.shift()! : (queue[0] ?? json({}, 404));
  }
}

describe('NaverWebtoonService', () => {
  let naver: FakeNaver;
  let realFetch: typeof globalThis.fetch;
  const service = new NaverWebtoonService();

  beforeEach(() => {
    realFetch = globalThis.fetch;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    naver = new FakeNaver();
    naver.install();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('여러 요일에 연재되는 작품은 한 번만 조회한다', async () => {
    naver.titleListMap = {
      MONDAY: [{ titleId: 1, titleName: '월목' }],
      THURSDAY: [{ titleId: 1, titleName: '월목' }],
    };
    naver.details.set(1, [json({ favoriteCount: 10 })]);

    const { items } = await service.fetchAllFavorites();

    expect(items).toHaveLength(1);
    expect(naver.calls.get(1)).toBe(1);
  });

  it('장르는 큐레이션 태그 → 광고 장르 코드 → 기타 순으로 정한다', async () => {
    naver.titleListMap = {
      MONDAY: [
        { titleId: 1, titleName: '태그' },
        { titleId: 2, titleName: '광고' },
        { titleId: 3, titleName: '없음' },
      ],
    };
    naver.details.set(1, [
      json({
        favoriteCount: 1,
        curationTagList: [
          { tagName: '먼치킨', curationType: 'CUSTOM_TAG' },
          { tagName: '스릴러', curationType: 'GENRE_THRILL' },
        ],
        gfpAdCustomParam: { genreTypes: ['DRAMA'] },
      }),
    ]);
    naver.details.set(2, [
      json({ favoriteCount: 2, gfpAdCustomParam: { genreTypes: ['PURE'] } }),
    ]);
    naver.details.set(3, [json({ favoriteCount: 3 })]);

    const { items } = await service.fetchAllFavorites();
    const genreOf = (id: number) => {
      const w = items.find((i) => i.titleId === id)!;
      return [w.genreCode, w.genreName];
    };

    expect(genreOf(1)).toEqual(['THRILL', '스릴러']);
    expect(genreOf(2)).toEqual(['PURE', '순정']);
    expect(genreOf(3)).toEqual(['ETC', '기타']);
  });

  it('찜 수가 없거나 4xx면 건너뛰고 실패로 센다', async () => {
    naver.titleListMap = {
      MONDAY: [
        { titleId: 1, titleName: '정상' },
        { titleId: 2, titleName: '찜 누락' },
        { titleId: 3, titleName: '없는 작품' },
      ],
    };
    naver.details.set(1, [json({ favoriteCount: 5 })]);
    naver.details.set(2, [json({})]);
    naver.details.set(3, [json({}, 404)]);

    const result = await service.fetchAllFavorites();

    expect(result.items.map((i) => i.titleId)).toEqual([1]);
    expect(result.failed).toBe(2);
    // 404는 재시도해도 같으므로 한 번만 부른다
    expect(naver.calls.get(3)).toBe(1);
  });

  it('429는 재시도해서 성공하면 정상 수집한다', async () => {
    naver.titleListMap = { MONDAY: [{ titleId: 1, titleName: '혼잡' }] };
    naver.details.set(1, [
      json({}, 429),
      json({}, 503),
      json({ favoriteCount: 7 }),
    ]);

    const result = await service.fetchAllFavorites();

    expect(result.items[0]?.favoriteCount).toBe(7);
    expect(naver.calls.get(1)).toBe(3);
  });
});
