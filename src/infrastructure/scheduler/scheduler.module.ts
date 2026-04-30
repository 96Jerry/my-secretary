import { Module } from '@nestjs/common';

import { MealPlanModule } from '../../modules/meal-plan/meal-plan.module.js';
import { UserModule } from '../../modules/user/user.module.js';
import { DiscordModule } from '../discord/discord.module.js';
import { DailyMealPlanJob } from './jobs/daily-meal-plan.job.js';

@Module({
  imports: [MealPlanModule, UserModule, DiscordModule],
  providers: [DailyMealPlanJob],
})
export class SchedulerModule {}
