import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NaverWebtoonModule } from '@infra/naver-webtoon/naver-webtoon.module.js';
import { WebtoonRankingModule } from '@modules/webtoon-ranking/webtoon-ranking.module.js';
import { WebtoonLogController } from './controller/webtoon-log.controller.js';
import { WEBTOON_LOG_REPOSITORY } from './domain/webtoon-log.repository.js';
import { WebtoonLogHistoryOrmEntity } from './repository/webtoon-log-history.orm-entity.js';
import { WebtoonLogOrmEntity } from './repository/webtoon-log.orm-entity.js';
import { WebtoonLogTypeormRepository } from './repository/webtoon-log.typeorm.repository.js';
import { WebtoonLogService } from './service/webtoon-log.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebtoonLogOrmEntity, WebtoonLogHistoryOrmEntity]),
    NaverWebtoonModule,
    WebtoonRankingModule,
  ],
  controllers: [WebtoonLogController],
  providers: [
    WebtoonLogService,
    { provide: WEBTOON_LOG_REPOSITORY, useClass: WebtoonLogTypeormRepository },
  ],
})
export class WebtoonLogModule {}
