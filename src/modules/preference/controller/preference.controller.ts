import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { Preference } from '../domain/preference.entity';
import { PreferenceService } from '../service/preference.service';

@Controller('users/:userId/preferences')
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  @Get()
  getLatest(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<Preference | null> {
    return this.preferenceService.getLatest(userId);
  }

  @Put()
  upsert(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<Preference> {
    return this.preferenceService.upsert(userId, body);
  }
}
