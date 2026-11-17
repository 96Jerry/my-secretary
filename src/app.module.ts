import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AppController } from './app.controller.js';

import { EnvModule } from './config/index.js';
import { ClaudeModule } from './infrastructure/claude/claude.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { DiscordModule } from './infrastructure/discord/discord.module.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';
import { MailModule } from './infrastructure/mail/mail.module.js';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module.js';
import { CgvImaxModule } from './modules/cgv-imax/cgv-imax.module.js';
import { FridgeModule } from './modules/fridge/fridge.module.js';
import { GameLogModule } from './modules/game-log/game-log.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MealLogModule } from './modules/meal-log/meal-log.module.js';
import { MealPlanModule } from './modules/meal-plan/meal-plan.module.js';
import { MotivationModule } from './modules/motivation/motivation.module.js';
import { PalworldNewsModule } from './modules/palworld-news/palworld-news.module.js';
import { PreferenceModule } from './modules/preference/preference.module.js';
import { ScheduleDomainModule } from './modules/schedule/schedule.module.js';
import { SituationModule } from './modules/situation/situation.module.js';
import { UserModule } from './modules/user/user.module.js';
import { WebtoonLogModule } from './modules/webtoon-log/webtoon-log.module.js';
import { WebtoonRankingModule } from './modules/webtoon-ranking/webtoon-ranking.module.js';
import { ProfilerModule } from '@infra/profiler/profiler.module.js';

@Module({
  imports: [
    EnvModule,
    LoggingModule,
    ScheduleModule.forRoot(),
    // 테일넷에서 브라우저로 보는 개인 페이지. dist가 아니라 저장소 루트의 public/을 쓴다.
    // renderPath를 '/'로 좁혀야 없는 API 경로가 index.html 대신 404를 돌려준다.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      renderPath: '/',
    }),
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
    CgvImaxModule,
    WebtoonRankingModule,
    WebtoonLogModule,
    GameLogModule,
    SchedulerModule,
    ProfilerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
