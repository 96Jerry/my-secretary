import { Module } from '@nestjs/common';

import { MealPlanModule } from '../../modules/meal-plan/meal-plan.module.js';
import { MotivationModule } from '../../modules/motivation/motivation.module.js';
import { UserModule } from '../../modules/user/user.module.js';
import { DiscordModule } from '../discord/discord.module.js';
import { DailyMealPlanJob } from './jobs/daily-meal-plan.job.js';
import { DailyMotivationJob } from './jobs/daily-motivation.job.js';
import { EveningCollectionJob } from './jobs/evening-collection.job.js';

@Module({
  imports: [MealPlanModule, UserModule, DiscordModule, MotivationModule],
  providers: [DailyMealPlanJob, DailyMotivationJob, EveningCollectionJob],
})
export class SchedulerModule {}
