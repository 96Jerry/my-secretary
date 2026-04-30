import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { HealthProfile } from '../domain/health.entity.js';
import { HealthService } from '../service/health.service.js';

@Controller('users/:userId/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getLatest(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<HealthProfile | null> {
    return this.healthService.getLatest(userId);
  }

  @Put()
  upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<HealthProfile> {
    return this.healthService.upsert(userId, body);
  }
}
