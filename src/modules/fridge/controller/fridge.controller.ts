import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { FridgeSnapshot } from '../domain/fridge.entity.js';
import { FridgeService } from '../service/fridge.service.js';

@Controller('users/:userId/fridge')
export class FridgeController {
  constructor(private readonly fridgeService: FridgeService) {}

  @Get()
  getLatest(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<FridgeSnapshot | null> {
    return this.fridgeService.getLatest(userId);
  }

  @Put()
  upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<FridgeSnapshot> {
    return this.fridgeService.upsert(userId, body);
  }
}
