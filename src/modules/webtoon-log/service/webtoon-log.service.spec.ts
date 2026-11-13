import { Logger } from '@nestjs/common';

import type {
  NaverLatestEpisode,
  NaverWebtoonService,
} from '@infra/naver-webtoon/naver-webtoon.service.js';
import type { WebtoonRankingService } from '@modules/webtoon-ranking/service/webtoon-ranking.service.js';
import type {
  WebtoonLog,
  WebtoonLogHistoryEntry,
  WebtoonLogInput,
  WebtoonPlatform,
} from '../domain/webtoon-log.entity.js';
import type { WebtoonLogRepository } from '../domain/webtoon-log.repository.js';
import { WebtoonLogService } from './webtoon-log.service.js';

/** 메모리 저장소 대역 */
class FakeRepository implements WebtoonLogRepository {
  readonly logs = new Map<string, WebtoonLog>();
  readonly histories = new Map<string, WebtoonLogHistoryEntry[]>();
  private seq = 0;

  findAll(): Promise<WebtoonLog[]> {
    return Promise.resolve([...this.logs.values()]);
  }

  findById(id: string): Promise<WebtoonLog | null> {
    return Promise.resolve(this.logs.get(id) ?? null);
  }

  findByKey(
    platform: WebtoonPlatform,
    title: string,
  ): Promise<WebtoonLog | null> {
    const found = [...this.logs.values()].find(
      (l) =>
        l.platform === platform &&
        l.title.replace(/\s+/g, '').toLowerCase() ===
          title.replace(/\s+/g, '').toLowerCase(),
    );
    return Promise.resolve(found ?? null);
  }

  save(input: WebtoonLogInput, id?: string): Promise<WebtoonLog> {
    const log = {
      ...input,
      id: id ?? `log-${++this.seq}`,
      updatedAt: new Date(),
    };
    this.logs.set(log.id, log);
    return Promise.resolve(log);
  }

  appendHistory(
    logId: string,
    entry: Omit<WebtoonLogHistoryEntry, 'recordedAt'>,
  ): Promise<void> {
    const list = this.histories.get(logId) ?? [];
    list.push({ ...entry, recordedAt: new Date() });
    this.histories.set(logId, list);
    return Promise.resolve();
  }

  findHistory(logId: string): Promise<WebtoonLogHistoryEntry[]> {
    return Promise.resolve(this.histories.get(logId) ?? []);
  }

  delete(id: string): Promise<boolean> {
    if (!this.logs.has(id)) return Promise.resolve(false);
    this.logs.delete(id);
    this.histories.delete(id);
    return Promise.resolve(true);
  }
}

describe('WebtoonLogService', () => {
  let repo: FakeRepository;
  let latest: Map<number, number | null>;
  let latestCalls: number[];
  let service: WebtoonLogService;

  beforeEach(() => {
    repo = new FakeRepository();
    latest = new Map();
    latestCalls = [];
    const naver = {
      fetchLatestEpisode: (titleId: number): Promise<NaverLatestEpisode> => {
        latestCalls.push(titleId);
        if (!latest.has(titleId)) return Promise.reject(new Error('down'));
        return Promise.resolve({
          episode: latest.get(titleId)!,
          publishedAt: null,
        });
      },
    } as unknown as NaverWebtoonService;
    const ranking = {
      getLatestTitles: () =>
        Promise.resolve([
          { titleId: 100, titleName: '화산귀환' },
          { titleId: 200, titleName: '나 혼자 만렙 뉴비' },
        ]),
    } as unknown as WebtoonRankingService;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new WebtoonLogService(repo, naver, ranking);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('네이버 작품은 제목(공백 무시)으로 찜 순위 작품과 연결한다', async () => {
      const a = await service.create({
        title: '화산귀환',
        platform: 'naver',
      });
      const b = await service.create({
        title: '나혼자 만렙뉴비',
        platform: 'naver',
      });
      const c = await service.create({
        title: '없는 작품',
        platform: 'naver',
      });

      expect([a.naverTitleId, b.naverTitleId, c.naverTitleId]).toEqual([
        100,
        200,
        null,
      ]);
    });

    it('네이버 주소를 주면 제목과 상관없이 그 titleId로 연결한다 (완결작 포함)', async () => {
      const log = await service.create({
        title: '오타난 제목',
        platform: 'naver',
        url: 'https://m.comic.naver.com/webtoon/list?titleId=999&tab=wed',
      });

      expect([log.naverTitleId, log.url]).toEqual([
        999,
        'https://m.comic.naver.com/webtoon/list?titleId=999&tab=wed',
      ]);
    });

    it('네이버가 아닌 주소는 저장만 하고 제목으로 연결한다', async () => {
      const a = await service.create({
        title: '화산귀환',
        platform: 'naver',
        url: 'https://example.com/?titleId=5',
      });
      const b = await service.create({
        title: '독점작',
        platform: 'kakaopage',
        url: 'https://page.kakao.com/content/123',
      });

      expect(a.naverTitleId).toBe(100);
      expect([b.naverTitleId, b.url]).toEqual([
        null,
        'https://page.kakao.com/content/123',
      ]);
    });

    it('네이버가 아니면 titleId를 줘도 연결하지 않는다', async () => {
      const log = await service.create({
        title: '화산귀환',
        platform: 'kakaopage',
        naverTitleId: 100,
      });

      expect(log.naverTitleId).toBeNull();
    });

    it('상태를 비우면 보는 중, 평가는 비워 둘 수 있다', async () => {
      const log = await service.create({
        title: 'A',
        platform: 'ridi',
        verdict: '',
      });

      expect([log.status, log.verdict]).toEqual(['reading', null]);
    });

    it('같은 플랫폼·제목은 띄어쓰기·대소문자가 달라도 거절한다', async () => {
      await service.create({ title: '화산귀환', platform: 'ridi' });

      await expect(
        service.create({ title: '화산 귀환', platform: 'ridi' }),
      ).rejects.toThrow('이미 기록한 작품');
    });

    it.each([
      [{ platform: 'naver' }, '제목'],
      [{ title: 'A', platform: 'webtoonland' }, '플랫폼'],
      [{ title: 'A', platform: 'naver', episode: -1 }, '회차'],
      [{ title: 'A', platform: 'naver', episode: '12' }, '회차'],
      [{ title: 'A', platform: 'naver', status: 'gone' }, '상태'],
      [{ title: 'A', platform: 'naver', lastReadAt: '2026/11/01' }, '날짜'],
      [{ title: 'A', platform: 'naver', url: 'javascript:alert(1)' }, '링크'],
    ])('잘못된 입력은 거절한다 %o', async (body, message) => {
      await expect(service.create(body)).rejects.toThrow(message);
    });
  });

  describe('update', () => {
    it('회차·상태·평가·날짜가 바뀔 때만 이력을 남긴다', async () => {
      const log = await service.create({
        title: 'A',
        platform: 'ridi',
        episode: 10,
      });
      await service.update(log.id, {
        title: 'A',
        platform: 'ridi',
        episode: 10,
        memo: '메모만',
      });
      await service.update(log.id, {
        title: 'A',
        platform: 'ridi',
        episode: 12,
        status: 'dropped',
        verdict: 'worst',
      });

      const history = await service.history(log.id);
      expect(history.map((h) => [h.episode, h.status, h.verdict])).toEqual([
        [10, 'reading', null],
        [12, 'dropped', 'worst'],
      ]);
    });

    it('다른 기록과 같은 제목으로 바꾸면 거절한다', async () => {
      await service.create({ title: 'A', platform: 'ridi' });
      const b = await service.create({ title: 'B', platform: 'ridi' });

      await expect(
        service.update(b.id, { title: 'A', platform: 'ridi' }),
      ).rejects.toThrow('이미 기록한 작품');
    });
  });

  describe('importMany', () => {
    it('새 작품은 만들고 이미 있는 작품은 덮어쓴다', async () => {
      await service.create({
        title: '화산귀환',
        platform: 'naver',
        episode: 1000,
      });

      const r = await service.importMany([
        { title: '화산귀환', platform: 'naver', episode: 1200 },
        { title: '전독시', platform: 'naver', status: 'completed' },
      ]);

      expect(r).toEqual({ created: 1, updated: 1 });
      const logs = await repo.findAll();
      expect(logs.find((l) => l.title === '화산귀환')?.episode).toBe(1200);
    });

    it('띄어쓰기만 다르면 기존 기록을 덮어쓰고 기존 표기를 유지한다', async () => {
      await service.create({ title: '화산귀환', platform: 'naver' });

      const r = await service.importMany([
        { title: '화산 귀환', platform: 'naver', episode: 5 },
      ]);

      expect(r).toEqual({ created: 0, updated: 1 });
      const [log] = await repo.findAll();
      expect([log?.title, log?.episode]).toEqual(['화산귀환', 5]);
    });

    it('틀린 줄이 하나라도 있으면 아무것도 저장하지 않고 틀린 줄을 모두 알려 준다', async () => {
      const result = service.importMany([
        { title: '정상', platform: 'naver' },
        { title: '', platform: 'naver' },
        { title: '정상', platform: 'naver' },
      ]);

      await expect(result).rejects.toMatchObject({
        response: {
          message: [
            '2번째 줄: 제목은 1~200자여야 합니다',
            '3번째 줄: 중복된 작품: 정상',
          ],
        },
      });
      expect(repo.logs.size).toBe(0);
    });
  });

  describe('list', () => {
    it('보는 중·보류인 네이버 작품만 밀린 회차를 세고, 최신 회차는 하루 한 번만 묻는다', async () => {
      latest.set(100, 1250);
      latest.set(200, 300);
      await service.create({
        title: '화산귀환',
        platform: 'naver',
        episode: 1200,
      });
      await service.create({
        title: '나 혼자 만렙 뉴비',
        platform: 'naver',
        episode: 10,
        status: 'dropped',
      });
      await service.create({
        title: '독점작',
        platform: 'kakaopage',
        episode: 5,
      });

      const first = await service.list();
      await service.list();
      const pick = (title: string) => {
        const l = first.find((x) => x.title === title)!;
        return [l.latestEpisode, l.unread];
      };

      expect(pick('화산귀환')).toEqual([1250, 50]);
      expect(pick('나 혼자 만렙 뉴비')).toEqual([null, null]);
      expect(pick('독점작')).toEqual([null, null]);
      expect(latestCalls).toEqual([100]);
    });

    it('최신 회차 조회에 실패해도 목록은 주고, 다음 조회 때 다시 묻는다', async () => {
      await service.create({
        title: '화산귀환',
        platform: 'naver',
        episode: 1,
      });

      const logs = await service.list();
      await service.list();

      expect(logs[0]?.unread).toBeNull();
      expect(latestCalls).toEqual([100, 100]);
    });
  });

  it('없는 기록은 지우거나 이력을 볼 수 없다', async () => {
    await expect(service.remove('nope')).rejects.toThrow('기록이 없습니다');
    await expect(service.history('nope')).rejects.toThrow('기록이 없습니다');
  });
});
