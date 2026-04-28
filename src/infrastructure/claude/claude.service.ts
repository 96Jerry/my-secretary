import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentVariables } from '../../config';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private readonly env: EnvironmentVariables) {}

  /**
   * 프롬프트를 Claude Agent SDK로 보내고 어시스턴트의 텍스트 출력을 반환한다.
   * 후속 단계에서 @anthropic-ai/claude-agent-sdk와 연결 예정.
   */
  run(prompt: string): Promise<string> {
    this.logger.debug(
      `Claude request (model=${this.env.CLAUDE_MODEL}, promptLength=${prompt.length})`,
    );
    return Promise.reject(new Error('ClaudeService.run not implemented'));
  }
}
