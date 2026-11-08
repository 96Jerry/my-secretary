import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '@config/index.js';
import { WebtoonRankingService } from '@modules/webtoon-ranking/service/webtoon-ranking.service.js';

@Injectable()
export class WebtoonRankingJob {
  private readonly logger = new Logger(WebtoonRankingJob.name);

  constructor(private readonly webtoonRankingService: WebtoonRankingService) {}

  @Cron(env.WEBTOON_RANKING_CRON, {
    name: 'webtoon-ranking',
    timeZone: 'Asia/Seoul',
    disabled: !env.CRON_ENABLED,
  })
  async run(): Promise<void> {
    await this.doWork();
  }

  async doWork(): Promise<void> {
    try {
      const r = await this.webtoonRankingService.collectToday();
      this.logger.log(
        `웹툰 찜 순위 수집: ${r.saved}개 저장, 실패 ${r.failed}, ${(r.elapsedMs / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      this.logger.error(
        `웹툰 찜 순위 잡 실패: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
