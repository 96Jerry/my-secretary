export const CGV_IMAX_REPOSITORY = Symbol('CGV_IMAX_REPOSITORY');

export interface CgvImaxRepository {
  /** 이미 알림을 보낸 회차 키 전체 */
  findAllKeys(): Promise<Set<string>>;
  /** 중복 키는 무시하고 저장 */
  saveKeys(keys: string[]): Promise<void>;
  /** 초기 동기화를 끝낸 영화 번호 전체 */
  findBootstrappedMovies(): Promise<Set<string>>;
  /** 이미 기록돼 있으면 무시 */
  markBootstrapped(movNo: string): Promise<void>;
}
