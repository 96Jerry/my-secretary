import { Injectable } from '@nestjs/common';

import { ClaudeService } from '@infra/claude/claude.service.js';
import { FridgeItem } from '../../fridge/domain/fridge-item.entity.js';
import { FridgeService } from '../../fridge/service/fridge.service.js';
import { HealthService } from '../../health/service/health.service.js';
import { MealLogService } from '../../meal-log/service/meal-log.service.js';
import { PreferenceService } from '../../preference/service/preference.service.js';
import { ScheduleService } from '../../schedule/service/schedule.service.js';
import { SituationService } from '../../situation/service/situation.service.js';
import { buildGenerateMealPlanPrompt } from '../domain/prompts/generate-meal-plan.prompt.js';

const RECENT_MEALS_DAYS = 7;

export interface MealPlanContext {
  userId: string;
  date: string;
  // 유통기한 임박 순 정렬. 비어 있으면 재고 미입력.
  fridge: FridgeItem[];
  health: Record<string, unknown> | null;
  preference: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
  situation: Record<string, unknown> | null;
  recentMeals: unknown[];
}

export interface GeneratedMealPlan {
  content: string;
}

@Injectable()
export class MealPlanGeneratorService {
  constructor(
    private readonly fridgeService: FridgeService,
    private readonly healthService: HealthService,
    private readonly preferenceService: PreferenceService,
    private readonly scheduleService: ScheduleService,
    private readonly situationService: SituationService,
    private readonly mealLogService: MealLogService,
    private readonly claudeService: ClaudeService,
  ) {}

  async generate(userId: string, date: string): Promise<GeneratedMealPlan> {
    const context = await this.collectContext(userId, date);
    const prompt = buildGenerateMealPlanPrompt(context);
    const content = await this.claudeService.run(prompt);
    return { content };
  }

  private async collectContext(
    userId: string,
    date: string,
  ): Promise<MealPlanContext> {
    const [fridge, health, preference, schedule, situation, recentLogs] =
      await Promise.all([
        this.fridgeService.getItems(userId),
        this.healthService.getLatest(userId),
        this.preferenceService.getLatest(userId),
        this.scheduleService.getForDate(userId, date),
        this.situationService.getLatest(userId),
        this.mealLogService.getRecent(userId, date, RECENT_MEALS_DAYS),
      ]);

    return {
      userId,
      date,
      fridge,
      health: health?.data ?? null,
      preference: preference?.data ?? null,
      schedule: schedule?.data ?? null,
      situation: situation?.data ?? null,
      recentMeals: recentLogs.map((m) => ({
        date: m.date,
        slot: m.slot,
        ...m.data,
      })),
    };
  }
}
