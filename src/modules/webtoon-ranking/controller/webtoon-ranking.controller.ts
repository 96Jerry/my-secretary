import { Controller, Get, Post, Query } from '@nestjs/common';

import {
  WebtoonRankingService,
  type WebtoonCollectResult,
  type WebtoonRanking,
} from '../service/webtoon-ranking.service.js';

// 사용자와 무관한 공개 데이터라 users/:userId 아래에 두지 않는다
@Controller('webtoons/ranking')
export class WebtoonRankingController {
  constructor(private readonly webtoonRankingService: WebtoonRankingService) {}

  // 크롤링하지 않고 DB의 최신 스냅샷만 읽는다
  @Get()
  getRanking(@Query('genre') genre?: string): Promise<WebtoonRanking> {
    return this.webtoonRankingService.getRanking(genre || undefined);
  }

  // 수동 수집. 이미 수집 중이면 그 결과를 함께 기다린다
  @Post('refresh')
  refresh(): Promise<WebtoonCollectResult> {
    return this.webtoonRankingService.collectToday();
  }
}
