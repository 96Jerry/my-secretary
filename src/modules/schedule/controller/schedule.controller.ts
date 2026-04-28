import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { ScheduleEntry } from '../domain/schedule.entity';
import { ScheduleService } from '../service/schedule.service';

@Controller('users/:userId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get(':date')
  getForDate(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('date') date: string,
  ): Promise<ScheduleEntry | null> {
    return this.scheduleService.getForDate(userId, date);
  }

  @Put(':date')
  upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('date') date: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ScheduleEntry> {
    return this.scheduleService.upsert(userId, date, body);
  }
}
