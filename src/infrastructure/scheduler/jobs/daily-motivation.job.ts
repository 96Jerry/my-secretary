import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '../../../config/index.js';
import { MotivationService } from '../../../modules/motivation/service/motivation.service.js';

@Injectable()
export class DailyMotivationJob {
  private readonly logger = new Logger(DailyMotivationJob.name);

  constructor(private readonly motivationService: MotivationService) {}

  @Cron(env.MOTIVATION_CRON, {
    name: 'daily-motivation',
    timeZone: 'Asia/Seoul',
  })
  async run(): Promise<void> {
    try {
      await this.motivationService.runDailyForAll();
    } catch (e) {
      this.logger.error(
        `동기부여 일일 잡 실패: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
