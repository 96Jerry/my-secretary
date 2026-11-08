import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NaverWebtoonModule } from '@infra/naver-webtoon/naver-webtoon.module.js';
import { WebtoonRankingController } from './controller/webtoon-ranking.controller.js';
import { WEBTOON_RANKING_REPOSITORY } from './domain/webtoon-ranking.repository.js';
import { WebtoonRankingSnapshotOrmEntity } from './repository/webtoon-ranking-snapshot.orm-entity.js';
import { WebtoonRankingTypeormRepository } from './repository/webtoon-ranking.typeorm.repository.js';
import { WebtoonRankingService } from './service/webtoon-ranking.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebtoonRankingSnapshotOrmEntity]),
    NaverWebtoonModule,
  ],
  controllers: [WebtoonRankingController],
  providers: [
    {
      provide: WEBTOON_RANKING_REPOSITORY,
      useClass: WebtoonRankingTypeormRepository,
    },
    WebtoonRankingService,
  ],
  exports: [WebtoonRankingService],
})
export class WebtoonRankingModule {}
