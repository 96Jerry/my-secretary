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
      `사용자의 자연어 메시지를 분석해 의도를 분류한다.`,
      ``,
      `[지원하는 의도]`,
      `- update_fridge: 냉장고 재고 추가, 차감, 설정`,
      `- update_health: 건강 정보 (목표, 나이, 체중, 키, 알레르기)`,
      `- update_preference: 선호 (추가구매 허용, 식사방식, 음식, 배달 선호)`,
      `- update_schedule: 특정 날짜의 일정 (수면, 약속, 운동)`,
      `- other: 그 외 (식단 추천 요청, 잡담 등)`,
      ``,
      `[오늘 날짜]`,
      ctx.today,
      `메시지의 "오늘"은 위 날짜, "내일"은 +1일, 요일·N일 후 등도 ISO YYYY-MM-DD로 변환.`,
      ``,
      `[현재 상태] 변경되지 않는 부분은 그대로 유지하고 메시지를 반영해 갱신.`,
      `- 냉장고: ${JSON.stringify(ctx.fridge)}`,
      `- 건강: ${JSON.stringify(ctx.health ?? {})}`,
      `- 선호: ${JSON.stringify(ctx.preference ?? {})}`,
      `- 오늘 일정: ${JSON.stringify(ctx.schedule ?? {})}`,
      ``,
      `[사용자 메시지]`,
      message,
      ``,
      `[지시]`,
      `- 의도 1개만 선택해 출력. 메시지가 여러 의도를 담아도 가장 비중 큰 하나만.`,
      `- 선택된 도메인의 전체 최종 상태를 출력 (diff가 아닌 통째 갱신본).`,
      `- summary는 사람이 읽기 쉬운 1~2문장 한국어 요약 (변경 포인트 위주).`,
      ``,
      `[출력 형식 — JSON 한 객체, 코드펜스 금지]`,
      `update_fridge: { "intent":"update_fridge", "items":[{"name":string,"quantity":string|number}], "summary":string }`,
      `update_health: { "intent":"update_health", "data":{...최종 건강 상태}, "summary":string }`,
      `update_preference: { "intent":"update_preference", "data":{...최종 선호 상태}, "summary":string }`,
      `update_schedule: { "intent":"update_schedule", "date":"YYYY-MM-DD", "data":{...해당 날짜의 최종 일정}, "summary":string }`,
      `other: { "intent":"other", "summary":string }`,
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
