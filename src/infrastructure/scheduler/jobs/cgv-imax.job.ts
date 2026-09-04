import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '@config/index.js';
import { CgvImaxService } from '@modules/cgv-imax/service/cgv-imax.service.js';

@Injectable()
export class CgvImaxJob {
  private readonly logger = new Logger(CgvImaxJob.name);

  constructor(private readonly cgvImaxService: CgvImaxService) {}

  // ResourceProfiler는 붙이지 않는다. 싱글턴 + 인터벌 핸들 1개라 다른 잡과 시각이
  // 겹치면 서로의 세션을 끝내버리고, 이 잡은 대부분이 네트워크 대기라
  // 메모리 스냅샷의 가치도 낮다. PalworldNewsJob과 같은 이유.
  @Cron(env.CGV_IMAX_CRON, {
    name: 'cgv-imax',
    timeZone: 'Asia/Seoul',
  })
  async run(): Promise<void> {
    await this.doWork();
  }

  async doWork(): Promise<void> {
    try {
      await this.cgvImaxService.checkForNewShowtimes();
    } catch (e) {
      this.logger.error(
        `CGV IMAX 회차 잡 실패: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
