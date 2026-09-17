import { Injectable, Logger } from '@nestjs/common';

import type { FridgeChange } from '@modules/fridge/domain/fridge-change.js';
import type {
  FridgeItem,
  FridgeUnit,
} from '@modules/fridge/domain/fridge-item.entity.js';
import type { MealSlot } from '@modules/meal-log/domain/meal-log.entity.js';
import { ClaudeService } from '../claude/claude.service.js';

const VALID_SLOTS: ReadonlySet<MealSlot> = new Set([
  'breakfast',
  'lunch',
  'dinner',
]);

const VALID_UNITS: ReadonlySet<string> = new Set(['g', 'ml', '개']);

export type ParsedIntent =
  | { intent: 'update_fridge'; changes: FridgeChange[]; summary: string }
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
  | {
      intent: 'update_situation';
      data: Record<string, unknown>;
      summary: string;
    }
  | {
      intent: 'update_meal_log';
      date: string;
      slot: MealSlot;
      data: Record<string, unknown>;
      summary: string;
    }
  | { intent: 'other'; summary: string };

export interface IntentContext {
  today: string;
  fridge: FridgeItem[];
  health: Record<string, unknown> | null;
  preference: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
  situation: Record<string, unknown> | null;
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
      `한국어 자연어 메시지를 7개 의도 중 하나로 분류하고, 해당 도메인의 최종 상태를 JSON으로 출력한다.`,
      `</role>`,
      ``,
      `<intents>`,
      `update_fridge: 냉장고 재고 추가·차감·설정`,
      `update_health: 건강 정보 (목표·나이·체중·키·알레르기)`,
      `update_preference: 선호 (추가구매 허용·식사방식·음식·배달 선호)`,
      `update_schedule: 특정 날짜의 일정 (수면·약속·운동)`,
      `update_situation: 생활 맥락 (가구 형태·주방 수준·예산 감각)`,
      `update_meal_log: 끼니별 실제 식사 기록 (메뉴·방식·주재료·조리법)`,
      `other: 위에 해당하지 않음 (식단 추천 요청·잡담 등)`,
      `</intents>`,
      ``,
      `<date_context>`,
      `오늘: ${ctx.today}`,
      `"오늘"=위 날짜, "내일"=+1일, "모레"=+2일, "N일 후"·"다음 주 X요일" 등 모든 상대 표현은 ISO YYYY-MM-DD로 변환한다.`,
      `</date_context>`,
      ``,
      `<current_state>`,
      `냉장고: ${JSON.stringify(ctx.fridge.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, expiresAt: i.expiresAt })))}`,
      `건강: ${JSON.stringify(ctx.health ?? {})}`,
      `선호: ${JSON.stringify(ctx.preference ?? {})}`,
      `오늘 일정: ${JSON.stringify(ctx.schedule ?? {})}`,
      `상황: ${JSON.stringify(ctx.situation ?? {})}`,
      `</current_state>`,
      ``,
      `<user_message>`,
      message,
      `</user_message>`,
      ``,
      `<rules>`,
      `1. 메시지에 여러 의도가 섞여 있어도 가장 비중 큰 1개만 선택한다.`,
      `2. 선택한 도메인은 diff가 아닌 **전체 최종 상태**로 출력한다 — 메시지에서 바뀌지 않은 필드는 current_state 값을 그대로 복사해 포함한다. (단 update_fridge와 update_meal_log는 예외이며 아래 규칙을 따른다.)`,
      `3. summary는 한국어 1~2문장, 변경 포인트 위주의 자연스러운 톤으로 작성한다.`,
      `4. 의도가 모호하거나 위 6개 도메인에 해당하지 않으면 other로 분류한다.`,
      `5. update_meal_log은 메시지에서 끼니(아침/점심/저녁)가 명시적으로 식별되어야만 출력한다. 식별 불가 시 other.`,
      `6. update_meal_log의 slot은 정확히 breakfast|lunch|dinner 중 하나. 한국어 표현은 매핑한다 (아침→breakfast, 점심→lunch, 저녁→dinner).`,
      `7. 출력은 JSON 객체 1개만. 코드펜스·주석·전후 텍스트 금지.`,
      `</rules>`,
      ``,
      `<fridge_rules>`,
      `update_fridge는 전체 목록이 아니라 **바뀐 아이템만** changes 배열로 출력한다. 언급되지 않은 아이템은 넣지 않는다.`,
      `op 선택:`,
      `- set: 새로 생긴 아이템이거나 수량을 특정 값으로 확정할 때 ("닭가슴살 800g 샀어", "계란 10개 있어").`,
      `- adjust: 기존 수량에서 더하거나 뺄 때. 차감은 음수 ("계란 3개 먹었어" → quantity: -3).`,
      `- remove: 다 써서 없어졌을 때 ("우유 다 먹었어").`,
      `quantity는 반드시 숫자, unit은 정확히 g|ml|개 중 하나로 변환한다 (1kg→1000 g, 1L→1000 ml, 한 팩·한 봉지 등 셀 수 있는 단위→개).`,
      `unit을 알 수 없거나 셋으로 변환이 불가능한 아이템은 changes에서 제외한다.`,
      `expiresAt은 메시지에 유통기한이 명시된 경우만 ISO YYYY-MM-DD로 넣고, 없으면 null.`,
      `adjust 대상이 current_state 냉장고에 없으면 그 아이템은 제외한다.`,
      `</fridge_rules>`,
      `</rules>`,
      ``,
      `<output_schema>`,
      `update_fridge     → { "intent":"update_fridge",     "changes":[{"op":"set","name":string,"quantity":number,"unit":"g|ml|개","expiresAt":"YYYY-MM-DD"|null} | {"op":"adjust","name":string,"quantity":number} | {"op":"remove","name":string}], "summary":string }`,
      `update_health     → { "intent":"update_health",     "data":{...최종 건강 상태},                          "summary":string }`,
      `update_preference → { "intent":"update_preference", "data":{...최종 선호 상태},                          "summary":string }`,
      `update_schedule   → { "intent":"update_schedule",   "date":"YYYY-MM-DD", "data":{...해당 날짜의 최종 일정}, "summary":string }`,
      `update_situation  → { "intent":"update_situation",  "data":{household,kitchenLevel,budgetLevel,...},     "summary":string }`,
      `update_meal_log   → { "intent":"update_meal_log",   "date":"YYYY-MM-DD", "slot":"breakfast|lunch|dinner", "data":{name,mode,mainIngredients,method,notes?}, "summary":string }`,
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
      changes?: unknown;
      data?: unknown;
      date?: unknown;
      slot?: unknown;
      summary?: unknown;
    };
    try {
      obj = JSON.parse(cleaned) as typeof obj;
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
          changes: toFridgeChanges(obj.changes),
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
      case 'update_situation':
        return { intent: 'update_situation', data, summary };
      case 'update_meal_log': {
        const slot = obj.slot;
        if (typeof slot !== 'string' || !VALID_SLOTS.has(slot as MealSlot)) {
          return { intent: 'other', summary };
        }
        return {
          intent: 'update_meal_log',
          date: typeof obj.date === 'string' ? obj.date : '',
          slot: slot as MealSlot,
          data,
          summary,
        };
      }
      default:
        return { intent: 'other', summary };
    }
  }
}

// LLM 출력이므로 op·수량·단위가 규칙을 벗어난 항목은 버린다.
function toFridgeChanges(raw: unknown): FridgeChange[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): FridgeChange[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { op, name, quantity, unit, expiresAt } = entry as Record<
      string,
      unknown
    >;
    if (typeof name !== 'string' || !name.trim()) return [];

    if (op === 'remove') return [{ op: 'remove', name }];

    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return [];

    if (op === 'adjust') {
      // 0은 변화가 없어 의미 없는 항목.
      return quantity === 0 ? [] : [{ op: 'adjust', name, quantity }];
    }

    if (op === 'set') {
      if (quantity <= 0) return [{ op: 'remove', name }];
      if (typeof unit !== 'string' || !VALID_UNITS.has(unit)) return [];
      return [
        {
          op: 'set',
          name,
          quantity,
          unit: unit as FridgeUnit,
          expiresAt: typeof expiresAt === 'string' ? expiresAt : null,
        },
      ];
    }

    return [];
  });
}
