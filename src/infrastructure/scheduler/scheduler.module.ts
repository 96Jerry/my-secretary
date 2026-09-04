import { Module } from '@nestjs/common';

import { CgvImaxModule } from '@modules/cgv-imax/cgv-imax.module.js';
import { MealPlanModule } from '@modules/meal-plan/meal-plan.module.js';
import { MotivationModule } from '@modules/motivation/motivation.module.js';
import { PalworldNewsModule } from '@modules/palworld-news/palworld-news.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { DiscordModule } from '../discord/discord.module.js';
import { CgvImaxJob } from './jobs/cgv-imax.job.js';
import { DailyMealPlanJob } from './jobs/daily-meal-plan.job.js';
import { DailyMotivationJob } from './jobs/daily-motivation.job.js';
import { EveningCollectionJob } from './jobs/evening-collection.job.js';
import { PalworldNewsJob } from './jobs/palworld-news.job.js';
import { ProfilerModule } from '@infra/profiler/profiler.module.js';

@Module({
  imports: [
    MealPlanModule,
    UserModule,
    DiscordModule,
    MotivationModule,
    PalworldNewsModule,
    CgvImaxModule,
    ProfilerModule,
  ],
  providers: [
    DailyMealPlanJob,
    DailyMotivationJob,
    EveningCollectionJob,
    PalworldNewsJob,
    CgvImaxJob,
  ],
})
export class SchedulerModule {}
