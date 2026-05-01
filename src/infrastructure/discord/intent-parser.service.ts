import { Injectable, Logger } from '@nestjs/common';

import { ClaudeService } from '../claude/claude.service.js';

export interface FridgeItem {
  name: string;
  quantity: string | number;
}

export type ParsedIntent =
  | { intent: 'update_fridge'; items: FridgeItem[]; summary: string }
  | {
      intent: 'update_health';
      data: Record<string, unknown>;
      summary: string;
    }
  | {
      intent: 'update_preference';
      data: Record<string, unknown>;
      summary: string;
    }
  | {
      intent: 'update_schedule';
      date: string;
      data: Record<string, unknown>;
      summary: string;
    }
  | { intent: 'other'; summary: string };

export interface IntentContext {
  today: string;
  fridge: { items: FridgeItem[] };
  health: Record<string, unknown> | null;
  preference: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
}

@Injectable()
export class IntentParserService {
  private readonly logger = new Logger(IntentParserService.name);

  constructor(private readonly claude: ClaudeService) {}

  async parse(message: string, ctx: IntentContext): Promise<ParsedIntent> {
    const prompt = this.buildPrompt(message, ctx);
    const raw = await this.claude.run(prompt);
    return this.extractJson(raw);
  }

  private buildPrompt(message: string, ctx: IntentContext): string {
    return [
      `<role>`,
      `한국어 자연어 메시지를 5개 의도 중 하나로 분류하고, 해당 도메인의 최종 상태를 JSON으로 출력한다.`,
      `</role>`,
      ``,
      `<intents>`,
      `update_fridge: 냉장고 재고 추가·차감·설정`,
      `update_health: 건강 정보 (목표·나이·체중·키·알레르기)`,
      `update_preference: 선호 (추가구매 허용·식사방식·음식·배달 선호)`,
      `update_schedule: 특정 날짜의 일정 (수면·약속·운동)`,
      `other: 위에 해당하지 않음 (식단 추천 요청·잡담 등)`,
      `</intents>`,
      ``,
      `<date_context>`,
      `오늘: ${ctx.today}`,
      `"오늘"=위 날짜, "내일"=+1일, "모레"=+2일, "N일 후"·"다음 주 X요일" 등 모든 상대 표현은 ISO YYYY-MM-DD로 변환한다.`,
      `</date_context>`,
      ``,
      `<current_state>`,
      `냉장고: ${JSON.stringify(ctx.fridge)}`,
      `건강: ${JSON.stringify(ctx.health ?? {})}`,
      `선호: ${JSON.stringify(ctx.preference ?? {})}`,
      `오늘 일정: ${JSON.stringify(ctx.schedule ?? {})}`,
      `</current_state>`,
      ``,
      `<user_message>`,
      message,
      `</user_message>`,
      ``,
      `<rules>`,
      `1. 메시지에 여러 의도가 섞여 있어도 가장 비중 큰 1개만 선택한다.`,
      `2. 선택한 도메인은 diff가 아닌 **전체 최종 상태**로 출력한다 — 메시지에서 바뀌지 않은 필드는 current_state 값을 그대로 복사해 포함한다.`,
      `3. summary는 한국어 1~2문장, 변경 포인트 위주의 자연스러운 톤으로 작성한다.`,
      `4. 의도가 모호하거나 위 4개 도메인에 해당하지 않으면 other로 분류한다.`,
      `5. 출력은 JSON 객체 1개만. 코드펜스·주석·전후 텍스트 금지.`,
      `</rules>`,
      ``,
      `<output_schema>`,
      `update_fridge     → { "intent":"update_fridge",     "items":[{"name":string,"quantity":string|number}], "summary":string }`,
      `update_health     → { "intent":"update_health",     "data":{...최종 건강 상태},                          "summary":string }`,
      `update_preference → { "intent":"update_preference", "data":{...최종 선호 상태},                          "summary":string }`,
      `update_schedule   → { "intent":"update_schedule",   "date":"YYYY-MM-DD", "data":{...해당 날짜의 최종 일정}, "summary":string }`,
      `other             → { "intent":"other", "summary":string }`,
      `</output_schema>`,
    ].join('\n');
  }

  private extractJson(raw: string): ParsedIntent {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let obj: {
      intent?: string;
      items?: unknown;
      data?: unknown;
      date?: unknown;
      summary?: unknown;
    };
    try {
      obj = JSON.parse(cleaned);
    } catch (err) {
      this.logger.warn(
        `의도 파싱 실패: ${(err as Error).message}. raw=${raw.slice(0, 200)}`,
      );
      return { intent: 'other', summary: '' };
    }

    const summary = typeof obj.summary === 'string' ? obj.summary : '';
    const data =
      typeof obj.data === 'object' && obj.data !== null
        ? (obj.data as Record<string, unknown>)
        : {};

    switch (obj.intent) {
      case 'update_fridge':
        return {
          intent: 'update_fridge',
          items: Array.isArray(obj.items) ? (obj.items as FridgeItem[]) : [],
          summary,
        };
      case 'update_health':
        return { intent: 'update_health', data, summary };
      case 'update_preference':
        return { intent: 'update_preference', data, summary };
      case 'update_schedule':
        return {
          intent: 'update_schedule',
          date: typeof obj.date === 'string' ? obj.date : '',
          data,
          summary,
        };
      default:
        return { intent: 'other', summary };
    }
  }
}
