import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { EnvironmentVariables } from '@config/index.js';
import {
  GameLogService,
  type GameSummary,
} from '../service/game-log.service.js';

@Controller('games')
export class GameLogController {
  constructor(
    private readonly gameLogService: GameLogService,
    private readonly env: EnvironmentVariables,
  ) {}

  // days: 최근 N일(오늘 포함). 비우거나 all이면 전체
  @Get()
  async summary(
    @Query('days') days?: string,
  ): Promise<GameSummary & { tracking: boolean }> {
    const summary = await this.gameLogService.summary(days);
    return { ...summary, tracking: !!this.env.DISCORD_GAME_USER_ID };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.gameLogService.remove(id);
  }
}
