import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '@config/index.js';
import { MotivationService } from '@modules/motivation/service/motivation.service.js';
import { ResourceProfilerService } from '@infra/profiler/resource-profiler.service.js';

@Injectable()
export class DailyMotivationJob {
  private readonly logger = new Logger(DailyMotivationJob.name);

  constructor(
    private readonly motivationService: MotivationService,
    private readonly resourceProfiler: ResourceProfilerService,
  ) {}

  @Cron(env.MOTIVATION_CRON, {
    name: 'daily-motivation',
    timeZone: 'Asia/Seoul',
  })
  async run(): Promise<void> {
    await this.resourceProfiler.profile(env.MOTIVATION_CRON, 3000, () =>
      this.doWork(),
    );
  }

  async doWork() {
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
