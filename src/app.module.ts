import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { env, EnvModule } from './config/index.js';
import { ClaudeModule } from './infrastructure/claude/claude.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { DiscordModule } from './infrastructure/discord/discord.module.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';
import { MailModule } from './infrastructure/mail/mail.module.js';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module.js';
import { FridgeModule } from './modules/fridge/fridge.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MealLogModule } from './modules/meal-log/meal-log.module.js';
import { MealPlanModule } from './modules/meal-plan/meal-plan.module.js';
import { MotivationModule } from './modules/motivation/motivation.module.js';
import { PalworldNewsModule } from './modules/palworld-news/palworld-news.module.js';
import { PreferenceModule } from './modules/preference/preference.module.js';
import { ScheduleDomainModule } from './modules/schedule/schedule.module.js';
import { SituationModule } from './modules/situation/situation.module.js';
import { UserModule } from './modules/user/user.module.js';
import { ProfilerModule } from '@infra/profiler/profiler.module.js';
import { createObserveModule } from '@nestjs/observe';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    EnvModule,
    LoggingModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    ClaudeModule,
    MailModule,
    DiscordModule,
    UserModule,
    FridgeModule,
    HealthModule,
    PreferenceModule,
    ScheduleDomainModule,
    SituationModule,
    MealLogModule,
    MealPlanModule,
    MotivationModule,
    PalworldNewsModule,
    SchedulerModule,
    ProfilerModule,
    ObserveModule.forRoot({
      appKey: env.OBSERVE_APP_KEY,
      appSecret: env.OBSERVE_APP_SECRET,
      serviceId: 'my-secretary-service',
    }),
  ],
})
export class AppModule {}
