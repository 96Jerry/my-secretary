import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env, EnvironmentVariables } from '../../../config';
import { MealPlanService } from '../../../modules/meal-plan/service/meal-plan.service';

@Injectable()
export class DailyMealPlanJob {
  private readonly logger = new Logger(DailyMealPlanJob.name);

  constructor(
    private readonly envVars: EnvironmentVariables,
    private readonly mealPlanService: MealPlanService,
  ) {}

  @Cron(env.MEAL_PLAN_CRON, { name: 'daily-meal-plan' })
  async run(): Promise<void> {
    const recipient = this.envVars.MEAL_PLAN_RECIPIENT;
    this.logger.log(`Generating and sending daily meal plan to ${recipient}`);
    await this.mealPlanService.generateAndSendDailyPlan(recipient);
  }
}
