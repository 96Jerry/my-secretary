import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '@config/index.js';
import { PalworldNewsService } from '@modules/palworld-news/service/palworld-news.service.js';

@Injectable()
export class PalworldNewsJob {
  private readonly logger = new Logger(PalworldNewsJob.name);

  constructor(private readonly palworldNewsService: PalworldNewsService) {}

  @Cron(env.PALWORLD_NEWS_CRON, {
    name: 'palworld-news',
    timeZone: 'Asia/Seoul',
  })
  async run(): Promise<void> {
    await this.doWork();
  }

  async doWork(): Promise<void> {
    try {
      await this.palworldNewsService.checkForNewPosts();
    } catch (e) {
      this.logger.error(
        `팰월드 패치노트 잡 실패: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
