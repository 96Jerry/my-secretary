import { MotivationProfile } from './motivation-profile.entity.js';

export const MOTIVATION_PROFILE_REPOSITORY = Symbol(
  'MOTIVATION_PROFILE_REPOSITORY',
);

export interface MotivationProfileRepository {
  findByUserId(userId: string): Promise<MotivationProfile | null>;
  findAllEnabled(): Promise<MotivationProfile[]>;
  updateGoalCache(
    userId: string,
    rewrittenGoal: string,
    goalHash: string,
  ): Promise<void>;
  updateSituationCache(
    userId: string,
    rewrittenSituation: string,
    situationHash: string,
  ): Promise<void>;

  // 22:00 알림 기능을 위한 placeholder. 본 작업에서는 호출자 없음.
  incrementDaysNotStudied(userId: string): Promise<void>;
  markStudied(userId: string, at: Date): Promise<void>;
}
