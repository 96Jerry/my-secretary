import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { FridgeItem } from '../domain/fridge-item.entity.js';
import { FridgeService } from '../service/fridge.service.js';

@Controller('users/:userId/fridge')
export class FridgeController {
  constructor(private readonly fridgeService: FridgeService) {}

  @Get()
  getItems(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<FridgeItem[]> {
    return this.fridgeService.getItems(userId);
  }
}
