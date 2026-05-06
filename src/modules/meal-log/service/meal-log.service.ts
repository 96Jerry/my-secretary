import { Inject, Injectable } from '@nestjs/common';

import { MealLog, MealSlot } from '../domain/meal-log.entity.js';
import {
  MEAL_LOG_REPOSITORY,
  type MealLogRepository,
} from '../domain/meal-log.repository.js';

@Injectable()
export class MealLogService {
  constructor(
    @Inject(MEAL_LOG_REPOSITORY)
    private readonly mealLogRepository: MealLogRepository,
  ) {}

  getForDate(userId: string, date: string): Promise<MealLog[]> {
    return this.mealLogRepository.findByUserAndDate(userId, date);
  }

  upsert(
    userId: string,
    date: string,
    slot: MealSlot,
    data: Record<string, unknown>,
  ): Promise<MealLog> {
    return this.mealLogRepository.upsert(userId, date, slot, data);
  }

  getRecent(
    userId: string,
    beforeDate: string,
    days: number,
  ): Promise<MealLog[]> {
    return this.mealLogRepository.findRecentByUser(userId, beforeDate, days);
  }
}
