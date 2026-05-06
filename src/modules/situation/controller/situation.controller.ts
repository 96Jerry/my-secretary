import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { Situation } from '../domain/situation.entity.js';
import { SituationService } from '../service/situation.service.js';

@Controller('users/:userId/situation')
export class SituationController {
  constructor(private readonly situationService: SituationService) {}

  @Get()
  getLatest(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<Situation | null> {
    return this.situationService.getLatest(userId);
  }

  @Put()
  upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<Situation> {
    return this.situationService.upsert(userId, body);
  }
}
