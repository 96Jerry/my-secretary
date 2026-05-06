import { Module } from '@nestjs/common';

import { FridgeModule } from '../../modules/fridge/fridge.module.js';
import { HealthModule } from '../../modules/health/health.module.js';
import { MealLogModule } from '../../modules/meal-log/meal-log.module.js';
import { PreferenceModule } from '../../modules/preference/preference.module.js';
import { ScheduleDomainModule } from '../../modules/schedule/schedule.module.js';
import { SituationModule } from '../../modules/situation/situation.module.js';
import { UserModule } from '../../modules/user/user.module.js';
import { ClaudeModule } from '../claude/claude.module.js';
import { DiscordService } from './discord.service.js';
import { IntentParserService } from './intent-parser.service.js';

@Module({
  imports: [
    ClaudeModule,
    FridgeModule,
    HealthModule,
    PreferenceModule,
    ScheduleDomainModule,
    SituationModule,
    MealLogModule,
    UserModule,
  ],
  providers: [DiscordService, IntentParserService],
  exports: [DiscordService],
})
export class DiscordModule {}
