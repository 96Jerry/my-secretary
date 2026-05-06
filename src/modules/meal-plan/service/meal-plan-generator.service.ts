import { Injectable } from '@nestjs/common';

import { ClaudeService } from '../../../infrastructure/claude/claude.service.js';
import { FridgeService } from '../../fridge/service/fridge.service.js';
import { HealthService } from '../../health/service/health.service.js';
import { PreferenceService } from '../../preference/service/preference.service.js';
import { ScheduleService } from '../../schedule/service/schedule.service.js';
import { SituationService } from '../../situation/service/situation.service.js';
import { buildGenerateMealPlanPrompt } from 'src/modules/meal-plan/domain/prompts/generate-meal-plan.prompt.js';

export interface MealPlanContext {
  userId: string;
  date: string;
  fridge: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  preference: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
  situation: Record<string, unknown> | null;
  recentMeals: unknown[];
}

@Injectable()
export class MealPlanGeneratorService {
  constructor(
    private readonly fridgeService: FridgeService,
    private readonly healthService: HealthService,
    private readonly preferenceService: PreferenceService,
    private readonly scheduleService: ScheduleService,
    private readonly situationService: SituationService,
    private readonly claudeService: ClaudeService,
  ) {}

  async generate(userId: string, date: string): Promise<string> {
    const context = await this.collectContext(userId, date);
    const prompt = buildGenerateMealPlanPrompt(context);
    return this.claudeService.run(prompt);
  }

  private async collectContext(
    userId: string,
    date: string,
  ): Promise<MealPlanContext> {
    const [fridge, health, preference, schedule, situation] = await Promise.all(
      [
        this.fridgeService.getLatest(userId),
        this.healthService.getLatest(userId),
        this.preferenceService.getLatest(userId),
        this.scheduleService.getForDate(userId, date),
        this.situationService.getLatest(userId),
      ],
    );

    return {
      userId,
      date,
      fridge: fridge?.data ?? null,
      health: health?.data ?? null,
      preference: preference?.data ?? null,
      schedule: schedule?.data ?? null,
      situation: situation?.data ?? null,
      recentMeals: [],
    };
  }
}
