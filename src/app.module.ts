import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { EnvModule } from './config';
import { ClaudeModule } from './infrastructure/claude/claude.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { DiscordModule } from './infrastructure/discord/discord.module';
import { MailModule } from './infrastructure/mail/mail.module';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module';
import { FridgeModule } from './modules/fridge/fridge.module';
import { HealthModule } from './modules/health/health.module';
import { MealPlanModule } from './modules/meal-plan/meal-plan.module';
import { PreferenceModule } from './modules/preference/preference.module';
import { ScheduleDomainModule } from './modules/schedule/schedule.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    EnvModule,
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
    MealPlanModule,
    SchedulerModule,
  ],
})
export class AppModule {}
