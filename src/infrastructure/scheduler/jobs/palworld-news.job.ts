import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '@config/index.js';
import { PalworldNewsService } from '@modules/palworld-news/service/palworld-news.service.js';

@Injectable()
export class PalworldNewsJob {
  private readonly logger = new Logger(PalworldNewsJob.name);

  constructor(private readonly palworldNewsService: PalworldNewsService) {}

  // ResourceProfiler는 싱글턴에 interval 핸들 하나만 유지해 재진입이 불가하다.
  // 1분 주기인 이 잡을 감싸면 하루 1회 잡들의 측정 세션을 상시 깨뜨리므로 사용하지 않는다.
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
