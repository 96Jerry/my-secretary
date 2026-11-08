import { Module } from '@nestjs/common';

import { NaverWebtoonService } from './naver-webtoon.service.js';

@Module({
  providers: [NaverWebtoonService],
  exports: [NaverWebtoonService],
})
export class NaverWebtoonModule {}
