import { MealLog, MealSlot } from './meal-log.entity.js';

export const MEAL_LOG_REPOSITORY = Symbol('MEAL_LOG_REPOSITORY');

export interface MealLogRepository {
  findByUserAndDate(userId: string, date: string): Promise<MealLog[]>;
  upsert(
    userId: string,
    date: string,
    slot: MealSlot,
    data: Record<string, unknown>,
  ): Promise<MealLog>;
  // beforeDate 기준 직전 days일 (beforeDate 당일 제외).
  findRecentByUser(
    userId: string,
    beforeDate: string,
    days: number,
  ): Promise<MealLog[]>;
}
