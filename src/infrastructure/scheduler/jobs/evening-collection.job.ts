import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { env } from '@config/index.js';
import { UserService } from '@modules/user/service/user.service.js';
import { DiscordService } from '../../discord/discord.service.js';
import { ResourceProfilerService } from '@infra/profiler/resource-profiler.service.js';

@Injectable()
export class EveningCollectionJob {
  private readonly logger = new Logger(EveningCollectionJob.name);

  constructor(
    private readonly userService: UserService,
    private readonly discordService: DiscordService,
    private readonly resourceProfiler: ResourceProfilerService,
  ) {}

  @Cron(env.EVENING_COLLECTION_CRON, {
    name: 'evening-collection',
    timeZone: 'Asia/Seoul',
  })
  async run(): Promise<void> {
    await this.resourceProfiler.profile(env.EVENING_COLLECTION_CRON, 3000, () =>
      this.doWork(),
    );
  }

  async doWork(): Promise<void> {
    const users = await this.userService.findAllWithGuildId();
    this.logger.log(`저녁 수집 발송 시작: ${users.length}명`);
    await Promise.allSettled(
      users.map((u) => this.discordService.promptEveningCollection(u)),
    );
  }
}
