import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { setTimeout as sleep } from 'node:timers/promises';

import { env } from '@config/index.js';
import { CgvImaxService } from '@modules/cgv-imax/service/cgv-imax.service.js';

// 크론이 매번 정확히 같은 초에 같은 요청을 보내면 그 규칙성 자체가 봇 신호가 된다.
// 주기마다 최대 이만큼 무작위로 흘려보낸다. 폴링 주기보다 충분히 짧아야 한다.
const MAX_JITTER_MS = 90_000;

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
    // 크론이 실제로 발화했다는 사실 자체를 남긴다. 이 줄이 없으면 스케줄러가
    // 안 돈 것인지 돌았는데 조용히 끝난 것인지 로그로 구분할 수 없다.
    const jitterMs = Math.floor(Math.random() * MAX_JITTER_MS);
    this.logger.log(`CGV 크론 발화 — 지터 ${Math.round(jitterMs / 1000)}초 대기`);
    await sleep(jitterMs);
    await this.doWork();
  }

  async doWork(): Promise<void> {
    try {
      await this.cgvImaxService.checkForNewShowtimes();
    } catch (e) {
      // 개별 실패는 서비스가 warn으로 남기므로, 여기까지 올라온 것은
      // 주기 자체가 깨진 경우다. 스택까지 디스코드로 보낸다.
      this.logger.error(
        `CGV IMAX 회차 잡 실패: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
