import { Module } from '@nestjs/common';

import { DiscordErrorReporter } from './discord-error-reporter.service.js';
import { DiscordWebhookLogger } from './discord-webhook.logger.js';

@Module({
  providers: [DiscordErrorReporter, DiscordWebhookLogger],
})
export class LoggingModule {}
