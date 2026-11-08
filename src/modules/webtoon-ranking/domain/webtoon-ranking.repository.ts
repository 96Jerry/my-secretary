import { WebtoonRankingEntry } from './webtoon-ranking-entry.entity.js';

export const WEBTOON_RANKING_REPOSITORY = Symbol('WEBTOON_RANKING_REPOSITORY');

export interface WebtoonRankingRepository {
  /** 같은 날짜에 다시 저장하면 작품별로 덮어쓴다 */
  saveSnapshot(date: string, entries: WebtoonRankingEntry[]): Promise<void>;
  /** 가장 최근 스냅샷 날짜(YYYY-MM-DD). 없으면 null */
  findLatestDate(): Promise<string | null>;
  /** 찜 수 내림차순 */
  findByDate(date: string): Promise<WebtoonRankingEntry[]>;
}
