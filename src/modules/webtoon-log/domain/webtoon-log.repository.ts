import type {
  WebtoonLog,
  WebtoonLogHistoryEntry,
  WebtoonLogInput,
  WebtoonPlatform,
} from './webtoon-log.entity.js';

export const WEBTOON_LOG_REPOSITORY = Symbol('WEBTOON_LOG_REPOSITORY');

export interface WebtoonLogRepository {
  findAll(): Promise<WebtoonLog[]>;
  findById(id: string): Promise<WebtoonLog | null>;
  /** 같은 플랫폼의 같은 제목은 한 건만 둔다. 제목은 공백·대소문자를 무시하고 비교한다 */
  findByKey(
    platform: WebtoonPlatform,
    title: string,
  ): Promise<WebtoonLog | null>;
  /** id가 있으면 그 기록을 덮어쓰고, 없으면 새로 만든다 */
  save(input: WebtoonLogInput, id?: string): Promise<WebtoonLog>;
  appendHistory(
    logId: string,
    entry: Omit<WebtoonLogHistoryEntry, 'recordedAt'>,
  ): Promise<void>;
  /** 오래된 순 */
  findHistory(logId: string): Promise<WebtoonLogHistoryEntry[]>;
  /** 이력도 함께 지운다. 없으면 false */
  delete(id: string): Promise<boolean>;
}
