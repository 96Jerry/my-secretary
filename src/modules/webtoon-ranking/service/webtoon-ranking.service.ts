import { Inject, Injectable } from '@nestjs/common';

import { NaverWebtoonService } from '@infra/naver-webtoon/naver-webtoon.service.js';
import { todayKstDate } from '@infra/time/kst-date.js';
import { WebtoonRankingEntry } from '../domain/webtoon-ranking-entry.entity.js';
import {
  WEBTOON_RANKING_REPOSITORY,
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
  genres: { code: string; name: string; count: number }[];
  items: (WebtoonRankingEntry & { rank: number })[];
}

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
    const snapshotDate = await this.repository.findLatestDate();
    if (!snapshotDate) return { snapshotDate: null, genres: [], items: [] };

    const all = await this.repository.findByDate(snapshotDate);
    const filtered = genreCode
      ? all.filter((e) => e.genreCode === genreCode)
      : all;
    return {
      snapshotDate,
      genres: countGenres(all),
      items: filtered.map((e, i) => ({ ...e, rank: i + 1 })),
    };
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
