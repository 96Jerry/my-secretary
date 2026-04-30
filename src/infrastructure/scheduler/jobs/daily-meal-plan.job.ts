import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env, EnvironmentVariables } from '../../../config/index.js';
import { MealPlanService } from '../../../modules/meal-plan/service/meal-plan.service.js';
import { UserService } from '../../../modules/user/service/user.service.js';
import { DiscordService } from '../../discord/discord.service.js';

@Injectable()
export class DailyMealPlanJob {
  private readonly logger = new Logger(DailyMealPlanJob.name);

  constructor(
    private readonly envVars: EnvironmentVariables,
    private readonly mealPlanService: MealPlanService,
    private readonly userService: UserService,
    private readonly discordService: DiscordService,
  ) {}

  @Cron(env.MEAL_PLAN_CRON, { name: 'daily-meal-plan' })
  async run(): Promise<void> {
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

    const discordUsers = await this.userService.findAllWithGuildId();
    this.logger.log(`Discord 사용자 ${discordUsers.length}명 미설정 검사 시작`);
    await Promise.allSettled(
      discordUsers.map((u) => this.discordService.notifyIfMissingSettings(u)),
    );
  }
}
