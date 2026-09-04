export const CGV_IMAX_REPOSITORY = Symbol('CGV_IMAX_REPOSITORY');

export interface CgvImaxRepository {
  /** 이미 알림을 보낸 회차 키 전체. 비어 있으면 최초 기동이다. */
  findAllKeys(): Promise<Set<string>>;
  /** 중복 키는 무시하고 저장 */
  saveKeys(keys: string[]): Promise<void>;
}
