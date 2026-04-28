import { Module } from '@nestjs/common';

import { FridgeModule } from '../../modules/fridge/fridge.module';
import { UserModule } from '../../modules/user/user.module';
import { ClaudeModule } from '../claude/claude.module';
import { DiscordService } from './discord.service';
import { IntentParserService } from './intent-parser.service';

@Module({
  imports: [ClaudeModule, FridgeModule, UserModule],
  providers: [DiscordService, IntentParserService],
})
export class DiscordModule {}
