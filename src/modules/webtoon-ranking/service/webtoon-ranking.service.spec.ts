import type { NaverWebtoonService } from '@infra/naver-webtoon/naver-webtoon.service.js';
import { WebtoonRankingEntry } from '../domain/webtoon-ranking-entry.entity.js';
import type {
  WebtoonHistoryPoint,
  WebtoonRankingRepository,
} from '../domain/webtoon-ranking.repository.js';
import { WebtoonRankingService } from './webtoon-ranking.service.js';

function entry(titleId: number, favoriteCount: number): WebtoonRankingEntry {
  return new WebtoonRankingEntry(
    titleId,
    `작품${titleId}`,
    favoriteCount,
    'DRAMA',
    '드라마',
    null,
    null,
    null,
    null,
    null,
  );
}

/** 날짜별 스냅샷을 메모리에 두는 저장소 대역 */
class FakeRepository implements WebtoonRankingRepository {
  readonly snapshots = new Map<string, WebtoonRankingEntry[]>();

  saveSnapshot(date: string, entries: WebtoonRankingEntry[]): Promise<void> {
    this.snapshots.set(date, entries);
    return Promise.resolve();
  }

  async findLatestDate(): Promise<string | null> {
    return (await this.findDates()).at(-1) ?? null;
  }

  findDates(): Promise<string[]> {
    return Promise.resolve([...this.snapshots.keys()].sort());
  }

  findByDate(date: string): Promise<WebtoonRankingEntry[]> {
    const rows = [...(this.snapshots.get(date) ?? [])];
    return Promise.resolve(
      rows.sort((a, b) => b.favoriteCount - a.favoriteCount),
    );
  }

  findHistory(): Promise<WebtoonHistoryPoint[]> {
    return Promise.resolve([]);
  }
}

describe('WebtoonRankingService', () => {
  let repo: FakeRepository;
  let service: WebtoonRankingService;

  beforeEach(() => {
    repo = new FakeRepository();
    service = new WebtoonRankingService(repo, {} as NaverWebtoonService);
  });

  describe('getMovers', () => {
    it('기간을 비우면 최근 두 스냅샷의 증감과 증가율을 낸다', async () => {
      repo.snapshots.set('2026-11-01', [entry(1, 100)]);
      repo.snapshots.set('2026-11-02', [entry(1, 120)]);
      repo.snapshots.set('2026-11-03', [entry(1, 150)]);

      const r = await service.getMovers();

      expect([r.fromDate, r.toDate]).toEqual(['2026-11-02', '2026-11-03']);
      expect(r.items[0]).toMatchObject({
        fromCount: 120,
        delta: 30,
        rate: 0.25,
      });
    });

    it('요청 날짜에 스냅샷이 없으면 기간 안쪽의 가장 가까운 날로 맞춘다', async () => {
      repo.snapshots.set('2026-11-01', [entry(1, 100)]);
      repo.snapshots.set('2026-11-05', [entry(1, 110)]);
      repo.snapshots.set('2026-11-09', [entry(1, 130)]);

      const r = await service.getMovers('2026-11-03', '2026-11-10');

      expect([r.fromDate, r.toDate]).toEqual(['2026-11-05', '2026-11-09']);
      expect(r.items[0]?.delta).toBe(20);
    });

    it('한쪽에만 있는 작품은 신규 진입·이탈로 따로 나눈다', async () => {
      repo.snapshots.set('2026-11-01', [entry(1, 100), entry(2, 50)]);
      repo.snapshots.set('2026-11-02', [entry(1, 100), entry(3, 10)]);

      const r = await service.getMovers();

      expect(r.items.map((i) => i.titleId)).toEqual([1]);
      expect(r.entered.map((i) => i.titleId)).toEqual([3]);
      expect(r.exited.map((i) => i.titleId)).toEqual([2]);
    });

    it('비교할 스냅샷이 하나뿐이면 빈 결과를 준다', async () => {
      repo.snapshots.set('2026-11-01', [entry(1, 100)]);

      const r = await service.getMovers();

      expect(r).toMatchObject({
        fromDate: null,
        toDate: '2026-11-01',
        items: [],
      });
    });

    it('시작 찜 수가 0이면 증가율은 null', async () => {
      repo.snapshots.set('2026-11-01', [entry(1, 0)]);
      repo.snapshots.set('2026-11-02', [entry(1, 5)]);

      const r = await service.getMovers();

      expect(r.items[0]).toMatchObject({ delta: 5, rate: null });
    });

    it('날짜 형식이 틀리면 거절한다', async () => {
      await expect(service.getMovers('2026/11/01')).rejects.toThrow(
        'YYYY-MM-DD',
      );
    });
  });

  describe('getRanking', () => {
    it('직전 스냅샷의 전체 순위·찜 수를 함께 준다', async () => {
      repo.snapshots.set('2026-11-01', [entry(1, 100), entry(2, 90)]);
      repo.snapshots.set('2026-11-02', [
        entry(1, 100),
        entry(2, 110),
        entry(3, 5),
      ]);

      const r = await service.getRanking();
      const pick = (id: number) => {
        const w = r.items.find((i) => i.titleId === id)!;
        return [w.rank, w.previousRank, w.previousFavoriteCount];
      };

      expect(r.previousDate).toBe('2026-11-01');
      expect(pick(2)).toEqual([1, 2, 90]);
      expect(pick(1)).toEqual([2, 1, 100]);
      expect(pick(3)).toEqual([3, null, null]);
    });
  });
});
