import { Injectable } from '@nestjs/common';

import { ClaudeService } from '@infra/claude/claude.service.js';
import { buildComposeMessagePrompt } from '../domain/prompts/compose-message.prompt.js';
import { withTimeout } from './timeout.js';

const LLM_TIMEOUT_MS = 60_000 * 5;

export interface ComposeInput {
  rewrittenGoal: string;
  rewrittenSituation: string;
  daysNotStudied: number;
  // 첫 실행이면 null. 프롬프트 입력에서는 "없음" 으로 치환.
  previousOutput: string | null;
}

@Injectable()
export class MotivationComposerService {
  constructor(private readonly claudeService: ClaudeService) {}

  async compose(input: ComposeInput): Promise<string> {
    const prompt = buildComposeMessagePrompt({
      rewrittenGoal: input.rewrittenGoal,
      rewrittenSituation: input.rewrittenSituation,
      daysNotStudied: input.daysNotStudied,
      previousOutput: input.previousOutput ?? '없음',
    });
    return withTimeout(
      this.claudeService.run(prompt),
      LLM_TIMEOUT_MS,
      'composeMessage',
    );
  }
}
