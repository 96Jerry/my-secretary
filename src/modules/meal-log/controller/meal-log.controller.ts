import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { MealLog, MealSlot } from '../domain/meal-log.entity.js';
import { MealLogService } from '../service/meal-log.service.js';

const VALID_SLOTS: ReadonlySet<MealSlot> = new Set([
  'breakfast',
  'lunch',
  'dinner',
]);

@Controller('users/:userId/meal-logs')
export class MealLogController {
  constructor(private readonly mealLogService: MealLogService) {}

  @Get(':date')
  getForDate(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('date') date: string,
  ): Promise<MealLog[]> {
    return this.mealLogService.getForDate(userId, date);
  }

  @Put(':date/:slot')
  upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('date') date: string,
    @Param('slot') slot: string,
    @Body() body: Record<string, unknown>,
  ): Promise<MealLog> {
    if (!VALID_SLOTS.has(slot as MealSlot)) {
      throw new BadRequestException(
        `slot must be one of breakfast, lunch, dinner`,
      );
    }
    return this.mealLogService.upsert(userId, date, slot as MealSlot, body);
  }
}
