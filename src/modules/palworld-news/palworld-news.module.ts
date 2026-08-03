import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MailModule } from '@infra/mail/mail.module.js';
import { SteamModule } from '@infra/steam/steam.module.js';
import { PALWORLD_NEWS_REPOSITORY } from './domain/palworld-news.repository.js';
import { PalworldNewsOrmEntity } from './repository/palworld-news.orm-entity.js';
import { PalworldNewsTypeormRepository } from './repository/palworld-news.typeorm.repository.js';
import { PalworldNewsService } from './service/palworld-news.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PalworldNewsOrmEntity]),
    SteamModule,
    MailModule,
  ],
  providers: [
    {
      provide: PALWORLD_NEWS_REPOSITORY,
      useClass: PalworldNewsTypeormRepository,
    },
    PalworldNewsService,
  ],
  exports: [PalworldNewsService],
})
export class PalworldNewsModule {}
