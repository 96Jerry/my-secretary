import { Injectable, Logger } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';

import { EnvironmentVariables } from '../../config';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private readonly env: EnvironmentVariables) {}

  async run(prompt: string): Promise<string> {
    this.logger.debug(
      `Claude request (model=${this.env.CLAUDE_MODEL}, promptLength=${prompt.length})`,
    );

    // CLAUDE_CODE_OAUTH_TOKEN은 dotenv가 process.env에 주입한 값을 SDK 서브프로세스가 그대로 읽음.
    const iter = query({
      prompt,
      options: {
        model: this.env.CLAUDE_MODEL,
        tools: [],
        permissionMode: 'dontAsk',
        settingSources: [],
      },
    });

    for await (const msg of iter) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        this.logger.log(
          `Claude session ${msg.session_id} (auth=${msg.apiKeySource})`,
        );
      } else if (msg.type === 'system' && msg.subtype === 'status') {
        this.logger.debug(`status=${msg.status}`);
      } else if (msg.type === 'result') {
        if (msg.subtype !== 'success') {
          throw new Error(`Claude run failed: ${msg.subtype}`);
        }
        return msg.result;
      }
    }
    throw new Error('Claude run ended without result');
  }
}
