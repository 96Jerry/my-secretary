import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { WebtoonHistoryPoint } from '../domain/webtoon-ranking.repository.js';
import {
  WebtoonRankingService,
  type WebtoonCollectResult,
  type WebtoonMovers,
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

  // 기간 내 찜 수 증감. 날짜는 YYYY-MM-DD, 비우면 최근 두 스냅샷을 비교한다
  @Get('movers')
  getMovers(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<WebtoonMovers> {
    return this.webtoonRankingService.getMovers(
      from || undefined,
      to || undefined,
    );
  }

  @Get(':titleId/history')
  getHistory(
    @Param('titleId', ParseIntPipe) titleId: number,
  ): Promise<WebtoonHistoryPoint[]> {
    return this.webtoonRankingService.getHistory(titleId);
  }

  // 수동 수집. 이미 수집 중이면 그 결과를 함께 기다린다
  @Post('refresh')
  refresh(): Promise<WebtoonCollectResult> {
    return this.webtoonRankingService.collectToday();
  }
}
