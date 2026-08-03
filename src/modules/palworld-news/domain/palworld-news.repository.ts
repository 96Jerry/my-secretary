export const PALWORLD_NEWS_REPOSITORY = Symbol('PALWORLD_NEWS_REPOSITORY');

export interface PalworldNewsRepository {
  /** 저장된 gid가 하나도 없으면 true (최초 기동 판단용) */
  isEmpty(): Promise<boolean>;
  /** 주어진 gid 중 이미 알고 있는 것만 반환 */
  findKnownGids(gids: string[]): Promise<Set<string>>;
  /** 중복 gid는 무시하고 저장 */
  saveGids(gids: string[]): Promise<void>;
}
