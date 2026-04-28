import { Injectable, Logger } from '@nestjs/common';

import { ClaudeService } from '../claude/claude.service';

export interface FridgeItem {
  name: string;
  quantity: string | number;
}

export interface ParsedIntent {
  intent: 'update_fridge' | 'other';
  items?: FridgeItem[];
  summary?: string;
}

@Injectable()
export class IntentParserService {
  private readonly logger = new Logger(IntentParserService.name);

  constructor(private readonly claude: ClaudeService) {}

  async parse(
    message: string,
    currentItems: FridgeItem[],
  ): Promise<ParsedIntent> {
    const prompt = this.buildPrompt(message, currentItems);
    const raw = await this.claude.run(prompt);
    return this.extractJson(raw);
  }

  private buildPrompt(message: string, currentItems: FridgeItem[]): string {
    return [
      `사용자의 자연어 메시지를 분석해 의도를 분류한다.`,
      ``,
      `[지원하는 의도]`,
      `- update_fridge: 냉장고 재고 추가/차감/설정 요청`,
      `- other: 그 외 (식단 추천 요청, 잡담, 일정/건강/선호 변경 등 모두 포함)`,
      ``,
      `[현재 냉장고 재고]`,
      JSON.stringify(currentItems),
      ``,
      `[사용자 메시지]`,
      message,
      ``,
      `[지시]`,
      `- 의도가 update_fridge면 메시지를 반영한 갱신 후 전체 items 배열을 출력 (diff가 아닌 최종 상태).`,
      `- summary는 사람이 읽기 쉬운 변경 요약 1~2문장 (한국어, 추가/차감/유지 명시).`,
      `- 의도가 other면 items는 빈 배열, summary는 빈 문자열.`,
      ``,
      `[출력 형식]`,
      `JSON 한 객체. 다른 텍스트나 마크다운 코드펜스 절대 금지.`,
      `{`,
      `  "intent": "update_fridge" | "other",`,
      `  "items": [{ "name": string, "quantity": string | number }],`,
      `  "summary": string`,
      `}`,
    ].join('\n');
  }

  private extractJson(raw: string): ParsedIntent {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      const obj = JSON.parse(cleaned) as Partial<ParsedIntent>;
      if (obj.intent !== 'update_fridge' && obj.intent !== 'other') {
        return { intent: 'other' };
      }
      return {
        intent: obj.intent,
        items: Array.isArray(obj.items) ? obj.items : [],
        summary: typeof obj.summary === 'string' ? obj.summary : '',
      };
    } catch (err) {
      this.logger.warn(
        `의도 파싱 실패: ${(err as Error).message}. raw=${raw.slice(0, 200)}`,
      );
      return { intent: 'other' };
    }
  }
}
