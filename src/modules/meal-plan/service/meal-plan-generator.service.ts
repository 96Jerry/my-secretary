import { Injectable } from '@nestjs/common';

import { ClaudeService } from '../../../infrastructure/claude/claude.service';
import { FridgeService } from '../../fridge/service/fridge.service';
import { HealthService } from '../../health/service/health.service';
import { PreferenceService } from '../../preference/service/preference.service';
import { ScheduleService } from '../../schedule/service/schedule.service';

export interface MealPlanContext {
  userId: string;
  date: string;
  fridge: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  preference: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
}

@Injectable()
export class MealPlanGeneratorService {
  constructor(
    private readonly fridgeService: FridgeService,
    private readonly healthService: HealthService,
    private readonly preferenceService: PreferenceService,
    private readonly scheduleService: ScheduleService,
    private readonly claudeService: ClaudeService,
  ) {}

  async generate(userId: string, date: string): Promise<string> {
    const context = await this.collectContext(userId, date);
    const prompt = this.buildPrompt(context);
    return this.claudeService.run(prompt);
  }

  private async collectContext(
    userId: string,
    date: string,
  ): Promise<MealPlanContext> {
    const [fridge, health, preference, schedule] = await Promise.all([
      this.fridgeService.getLatest(userId),
      this.healthService.getLatest(userId),
      this.preferenceService.getLatest(userId),
      this.scheduleService.getForDate(userId, date),
    ]);

    return {
      userId,
      date,
      fridge: fridge?.data ?? null,
      health: health?.data ?? null,
      preference: preference?.data ?? null,
      schedule: schedule?.data ?? null,
    };
  }

  private buildPrompt(ctx: MealPlanContext): string {
    return [
      `${ctx.date}의 아침/점심/저녁 식단을 짜줘.`,
      [
        `[전제]`,
        `- 소금, 후추, 간장, 식용유 등 기본 조미료는 모두 갖춰져 있다고 가정.`,
        `- 사용자가 허용한 식사 방식(요리/배달/외식) 중 끼니별 상황에 가장 적합한 것을 끼니마다 골라 추천.`,
      ].join('\n'),
      `[냉장고 재고]\n${JSON.stringify(ctx.fridge ?? {})}`,
      [
        `[건강/목표]`,
        JSON.stringify(ctx.health ?? {}),
        `- "goal"(예: muscle_gain, diet, balanced) 이 있으면 칼로리/매크로 비율을 그에 맞춰 조정.`,
      ].join('\n'),
      [
        `[선호]`,
        JSON.stringify(ctx.preference ?? {}),
        `- "allowAdditionalShopping": true 면 냉장고 외 추가 식재료 구매 가능. false 면 냉장고 + 기본 조미료만으로 구성.`,
        `- "modes": 허용된 식사 방식 (["cook","delivery","eatOut"] 중 일부). 명시 없으면 모두 허용.`,
        `- "foods": 선호하는 음식 종류/재료/요리법.`,
        `- "delivery": 선호하는 배달 또는 매장 메뉴.`,
      ].join('\n'),
      [
        `[일정]`,
        JSON.stringify(ctx.schedule ?? {}),
        `- "sleep": 취침/기상 시간. 늦게 자거나 일찍 일어나는 끼니에 반영.`,
        `- "appointments": 약속/외출 일정. 시간이 빠듯하면 간단식/포장/외식 우선.`,
        `- "workout": 운동 일정. 운동 전/후 끼니의 영양 구성과 타이밍에 반영.`,
      ].join('\n'),
      [
        `[출력 형식: HTML 이메일 본문, 한국어]`,
        `- 상단에 "오늘 장보기" 섹션. allowAdditionalShopping=true 면 필요한 추가 식재료 목록, false 면 "추가 구매 없음" 한 줄.`,
        `- 아침 / 점심 / 저녁 각각 다음 구조:`,
        `  - 끼니 방향성 한 줄 요약 (예: "운동 후 단백질 위주").`,
        `  - 추천 2가지. 각 추천은 다음을 포함:`,
        `    - 방식 (요리 / 배달 / 외식)`,
        `    - 메뉴명`,
        `    - 요리인 경우: 재료 목록 + 간단한 요리법`,
        `    - 배달/외식인 경우: 추천 메뉴 + 가게/체인 예시 (가능하면)`,
        `- <h2>, <ul>, <p> 등 가독성 좋은 HTML 태그 사용.`,
      ].join('\n'),
    ].join('\n\n');
  }
}
