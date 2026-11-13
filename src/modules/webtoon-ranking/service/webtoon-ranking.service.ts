import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { NaverWebtoonService } from '@infra/naver-webtoon/naver-webtoon.service.js';
import { todayKstDate } from '@infra/time/kst-date.js';
import { WebtoonRankingEntry } from '../domain/webtoon-ranking-entry.entity.js';
import {
  WEBTOON_RANKING_REPOSITORY,
  type WebtoonHistoryPoint,
  type WebtoonRankingRepository,
} from '../domain/webtoon-ranking.repository.js';

export interface WebtoonCollectResult {
  snapshotDate: string;
  saved: number;
  failed: number;
  elapsedMs: number;
}

export interface WebtoonRanking {
  // 스냅샷이 아직 없으면 null
  snapshotDate: string | null;
  // 비교 대상인 직전 스냅샷 날짜. 스냅샷이 하루치뿐이면 null
  previousDate: string | null;
  genres: { code: string; name: string; count: number }[];
  items: (WebtoonRankingEntry & {
    rank: number;
    // 직전 스냅샷에 없던 작품이면 둘 다 null
    previousRank: number | null;
    previousFavoriteCount: number | null;
  })[];
}

export interface WebtoonMover extends WebtoonRankingEntry {
  fromCount: number;
  delta: number;
  // 증가율(0.5 = 50%). 시작 시점 찜 수가 0이면 null
  rate: number | null;
}

export interface WebtoonMovers {
  // 스냅샷이 있는 날짜 전체. 화면의 기간 선택에 쓴다
  dates: string[];
  // 실제로 비교한 날짜. 요청한 날짜에 스냅샷이 없으면 가장 가까운 날로 맞춘다
  fromDate: string | null;
  toDate: string | null;
  // 양쪽 날짜에 모두 있는 작품
  items: WebtoonMover[];
  // 기간 중 새로 연재 목록에 들어온 작품
  entered: WebtoonRankingEntry[];
  // 기간 중 연재 목록에서 빠진 작품 (완결·연재 중단 등)
  exited: WebtoonRankingEntry[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class WebtoonRankingService {
  // 수동 버튼 연타나 cron과 겹쳐도 네이버에 800여 건을 두 번 보내지 않도록
  // 진행 중인 수집을 공유한다.
  private inFlight: Promise<WebtoonCollectResult> | null = null;

  constructor(
    @Inject(WEBTOON_RANKING_REPOSITORY)
    private readonly repository: WebtoonRankingRepository,
    private readonly naverWebtoon: NaverWebtoonService,
  ) {}

  collectToday(): Promise<WebtoonCollectResult> {
    this.inFlight ??= this.collect().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async getRanking(genreCode?: string): Promise<WebtoonRanking> {
    const dates = await this.repository.findDates();
    const snapshotDate = dates.at(-1);
    if (!snapshotDate) {
      return { snapshotDate: null, previousDate: null, genres: [], items: [] };
    }
    const previousDate = dates.at(-2) ?? null;

    const [all, previous] = await Promise.all([
      this.repository.findByDate(snapshotDate),
      previousDate ? this.repository.findByDate(previousDate) : [],
    ]);
    // 순위 변동은 장르 필터와 무관하게 전체 순위끼리 비교한다
    const previousById = new Map(
      previous.map((e, i) => [
        e.titleId,
        { rank: i + 1, count: e.favoriteCount },
      ]),
    );
    const ranked = all.map((e, i) => {
      const prev = previousById.get(e.titleId);
      return {
        ...e,
        rank: i + 1,
        previousRank: prev?.rank ?? null,
        previousFavoriteCount: prev?.count ?? null,
      };
    });
    return {
      snapshotDate,
      previousDate,
      genres: countGenres(all),
      items: genreCode
        ? ranked.filter((e) => e.genreCode === genreCode)
        : ranked,
    };
  }

  /**
   * 두 날짜 사이 찜 수 변화. from을 비우면 to 직전 스냅샷과 비교한다.
   * 정렬과 최소 찜 수 필터는 화면에서 바꿔 가며 보므로 여기서는 하지 않는다.
   */
  async getMovers(from?: string, to?: string): Promise<WebtoonMovers> {
    for (const d of [from, to]) {
      if (d && !ISO_DATE.test(d)) {
        throw new BadRequestException(`날짜 형식은 YYYY-MM-DD: ${d}`);
      }
    }

    const dates = await this.repository.findDates();
    const toDate = to ? dates.findLast((d) => d <= to) : dates.at(-1);
    const fromDate =
      toDate &&
      (from
        ? dates.find((d) => d >= from && d < toDate)
        : dates.findLast((d) => d < toDate));
    if (!toDate || !fromDate) {
      return {
        dates,
        fromDate: null,
        toDate: toDate ?? null,
        items: [],
        entered: [],
        exited: [],
      };
    }

    const [before, after] = await Promise.all([
      this.repository.findByDate(fromDate),
      this.repository.findByDate(toDate),
    ]);
    const beforeById = new Map(before.map((e) => [e.titleId, e]));
    const afterIds = new Set(after.map((e) => e.titleId));

    const items: WebtoonMover[] = [];
    const entered: WebtoonRankingEntry[] = [];
    for (const e of after) {
      const prev = beforeById.get(e.titleId);
      if (!prev) {
        entered.push(e);
        continue;
      }
      const delta = e.favoriteCount - prev.favoriteCount;
      items.push({
        ...e,
        fromCount: prev.favoriteCount,
        delta,
        rate: prev.favoriteCount > 0 ? delta / prev.favoriteCount : null,
      });
    }
    return {
      dates,
      fromDate,
      toDate,
      items,
      entered,
      exited: before.filter((e) => !afterIds.has(e.titleId)),
    };
  }

  /** 최신 스냅샷의 작품 목록. 열람 기록을 네이버 작품과 연결할 때 쓴다 */
  async getLatestTitles(): Promise<WebtoonRankingEntry[]> {
    const date = await this.repository.findLatestDate();
    return date ? this.repository.findByDate(date) : [];
  }

  getHistory(titleId: number): Promise<WebtoonHistoryPoint[]> {
    return this.repository.findHistory(titleId);
  }

  private async collect(): Promise<WebtoonCollectResult> {
    const startedAt = Date.now();
    // 수집 도중 자정을 넘겨도 시작 시점 날짜로 저장한다
    const snapshotDate = todayKstDate();
    const { items, failed } = await this.naverWebtoon.fetchAllFavorites();
    await this.repository.saveSnapshot(
      snapshotDate,
      items.map(
        (w) =>
          new WebtoonRankingEntry(
            w.titleId,
            w.titleName,
            w.favoriteCount,
            w.genreCode,
            w.genreName,
            w.author,
            w.thumbnailUrl,
            w.starScore,
            w.isRest,
            w.isNew,
          ),
      ),
    );
    return {
      snapshotDate,
      saved: items.length,
      failed,
      elapsedMs: Date.now() - startedAt,
    };
  }
}

// 작품 수 많은 장르부터
function countGenres(entries: WebtoonRankingEntry[]): WebtoonRanking['genres'] {
  const byCode = new Map<
    string,
    { code: string; name: string; count: number }
  >();
  for (const e of entries) {
    const genre = byCode.get(e.genreCode);
    if (genre) genre.count++;
    else
      byCode.set(e.genreCode, {
        code: e.genreCode,
        name: e.genreName,
        count: 1,
      });
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count);
}
