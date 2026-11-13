import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';

import type {
  WebtoonLog,
  WebtoonLogHistoryEntry,
} from '../domain/webtoon-log.entity.js';
import {
  WebtoonLogService,
  type WebtoonLogImportResult,
  type WebtoonLogView,
} from '../service/webtoon-log.service.js';

// 본인 한 명만 쓰므로 users/:userId 아래에 두지 않는다
@Controller('webtoons/logs')
export class WebtoonLogController {
  constructor(private readonly webtoonLogService: WebtoonLogService) {}

  // 네이버 연재작은 최신 회차와 밀린 회차 수를 함께 준다
  @Get()
  list(): Promise<WebtoonLogView[]> {
    return this.webtoonLogService.list();
  }

  @Post()
  create(@Body() body: unknown): Promise<WebtoonLog> {
    return this.webtoonLogService.create(body);
  }

  // 붙여넣기 일괄 등록. 본문은 기록 배열
  @Post('import')
  importMany(@Body() body: unknown): Promise<WebtoonLogImportResult> {
    return this.webtoonLogService.importMany(body);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WebtoonLog> {
    return this.webtoonLogService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.webtoonLogService.remove(id);
  }

  @Get(':id/history')
  history(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebtoonLogHistoryEntry[]> {
    return this.webtoonLogService.history(id);
  }
}
