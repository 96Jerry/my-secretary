import { Module } from '@nestjs/common';

import { SteamNewsService } from './steam-news.service.js';

@Module({
  providers: [SteamNewsService],
  exports: [SteamNewsService],
})
export class SteamModule {}
