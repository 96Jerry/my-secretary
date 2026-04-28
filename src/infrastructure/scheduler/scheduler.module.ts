import { Module } from '@nestjs/common';

import { MealPlanModule } from '../../modules/meal-plan/meal-plan.module';
import { UserModule } from '../../modules/user/user.module';
import { DiscordModule } from '../discord/discord.module';
import { DailyMealPlanJob } from './jobs/daily-meal-plan.job';

@Module({
  imports: [MealPlanModule, UserModule, DiscordModule],
  providers: [DailyMealPlanJob],
})
export class SchedulerModule {}
