import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env, EnvironmentVariables } from '@config/index.js';
import { MealPlanService } from '@modules/meal-plan/service/meal-plan.service.js';
import { ResourceProfilerService } from '@infra/profiler/resource-profiler.service.js';

@Injectable()
export class DailyMealPlanJob {
  private readonly logger = new Logger(DailyMealPlanJob.name);

  constructor(
    private readonly envVars: EnvironmentVariables,
    private readonly mealPlanService: MealPlanService,
    private readonly resourceProfiler: ResourceProfilerService,
  ) {}

  @Cron(env.MEAL_PLAN_CRON, { name: 'daily-meal-plan', timeZone: 'Asia/Seoul' })
  async run(): Promise<void> {
    await this.resourceProfiler.profile(env.MEAL_PLAN_CRON, 3000, () =>
      this.doWork(),
    );
  }

  async doWork(): Promise<void> {
    const recipient = this.envVars.MEAL_PLAN_RECIPIENT;
    this.logger.log(`이메일 식단 발송 시작: ${recipient}`);
    try {
      await this.mealPlanService.generateAndSendDailyPlan(recipient);
    } catch (e) {
      this.logger.error(
        `이메일 식단 발송 실패: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
