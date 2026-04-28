import { Module } from '@nestjs/common';

import { FridgeModule } from '../../modules/fridge/fridge.module';
import { HealthModule } from '../../modules/health/health.module';
import { PreferenceModule } from '../../modules/preference/preference.module';
import { ScheduleDomainModule } from '../../modules/schedule/schedule.module';
import { UserModule } from '../../modules/user/user.module';
import { ClaudeModule } from '../claude/claude.module';
import { DiscordService } from './discord.service';
import { IntentParserService } from './intent-parser.service';

@Module({
  imports: [
    ClaudeModule,
    FridgeModule,
    HealthModule,
    PreferenceModule,
    ScheduleDomainModule,
    UserModule,
  ],
  providers: [DiscordService, IntentParserService],
})
export class DiscordModule {}
