import { Module } from '@nestjs/common';

import { MealPlanModule } from '../../modules/meal-plan/meal-plan.module';
import { DailyMealPlanJob } from './jobs/daily-meal-plan.job';

@Module({
  imports: [MealPlanModule],
  providers: [DailyMealPlanJob],
})
export class SchedulerModule {}
