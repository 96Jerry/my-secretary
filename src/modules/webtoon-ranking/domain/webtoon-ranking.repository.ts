import { WebtoonRankingEntry } from './webtoon-ranking-entry.entity.js';

export const WEBTOON_RANKING_REPOSITORY = Symbol('WEBTOON_RANKING_REPOSITORY');

export interface WebtoonHistoryPoint {
  snapshotDate: string;
  favoriteCount: number;
  starScore: number | null;
}

export interface WebtoonRankingRepository {
  /** 같은 날짜에 다시 저장하면 작품별로 덮어쓴다 */
  saveSnapshot(date: string, entries: WebtoonRankingEntry[]): Promise<void>;
  /** 가장 최근 스냅샷 날짜(YYYY-MM-DD). 없으면 null */
  findLatestDate(): Promise<string | null>;
  /** 스냅샷이 있는 날짜 전체(YYYY-MM-DD), 오래된 순 */
  findDates(): Promise<string[]>;
  /** 찜 수 내림차순 */
  findByDate(date: string): Promise<WebtoonRankingEntry[]>;
  /** 한 작품의 날짜별 찜 수, 오래된 순 */
  findHistory(titleId: number): Promise<WebtoonHistoryPoint[]>;
}
