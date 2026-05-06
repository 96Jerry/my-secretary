import { MealPlanContext } from 'src/modules/meal-plan/service/meal-plan-generator.service.js';

export function buildGenerateMealPlanPrompt(ctx: MealPlanContext): string {
  return `${ctx.date}의 아침/점심/저녁 식단을 추천해줘.

<역할>
사용자의 냉장고 재고, 건강 목표, 일정, 상황, 선호, 최근 식사 이력을 종합해 실행 가능한 하루 식단을 짜는 식단 코치.
</역할>

<전제>
- 소금, 후추, 간장, 식용유, 설탕 등 기본 조미료는 모두 갖춰져 있다고 가정.
- 끼니마다 사용자의 허용된 식사 방식(요리/배달/외식) 중 그 시간대 상황(일정/컨디션/이동)에 가장 적합한 것을 별도로 선택.
- 아침/점심을 요리로 추천할 경우: 냉장고 재고 + 기본 조미료만 사용. 추가 식재료 금지.
- 저녁을 요리로 추천할 경우: "preference.allowAdditionalShopping" 이 true 면 오늘 장 본 식재료 사용 가능, false 면 냉장고 + 조미료만 사용.
- 장보기 빈도는 "preference.shoppingFrequency"(weekly | asNeeded 등)를 따름. 기본 주 1회. 재고 충분하면 추가 구매 자제, 부족할 때만 며칠치 커버하도록 한 번에 구매.
- "recentMeals" 에 있는 메뉴와 같은 주재료+조리법 조합은 회피. "preference.varietyAffinity" 가 high 면 적극적으로 새로운 메뉴, low 면 익숙한 메뉴 위주.
- 알레르기/제한 식품은 절대 포함 금지.
- "preference.modes" 에 없는 방식은 절대 추천하지 말 것.
</전제>

<냉장고_재고>
${JSON.stringify(ctx.fridge ?? {})}
</냉장고_재고>

<상황>
${JSON.stringify(ctx.situation ?? {})}
- "household": 자취생 / 2인가구 / 가족 등. 자취생이면 1인분 분량 + 손질 부담 적은 메뉴 우선.
- "kitchenLevel": 주방 도구/스킬 수준. 낮으면 단순 조리 우선.
- "budgetLevel": 예산 감각. 낮으면 배달/외식 빈도와 단가를 보수적으로.
</상황>

<건강_목표>
${JSON.stringify(ctx.health ?? {})}
- "goal" (muscle_gain | diet | balanced 등) 에 맞춰 끼니별 칼로리/매크로 비율 조정.
- "allergies", "restrictions" 명시 시 절대 포함 금지.
</건강_목표>

<선호>
${JSON.stringify(ctx.preference ?? {})}
- "modes": 허용 식사 방식 배열. 명시 없으면 모두 허용.
- "allowAdditionalShopping": false 면 저녁도 냉장고+조미료만으로 구성, 장보기는 "추가 구매 없음".
- "foods": 선호 음식 종류/재료/요리법.
- "delivery": 선호 배달/매장 메뉴.
- "varietyAffinity": high | medium | low.
- "shoppingFrequency": weekly | asNeeded 등.
</선호>

<일정>
${JSON.stringify(ctx.schedule ?? {})}
- "sleep": 취침/기상 시간. 식사 시간 추천에 반영.
- "appointments": 약속/외출. 시간 빠듯하면 간단식/포장/외식 우선.
- "workout": 운동 일정. 전/후 끼니의 영양 구성과 타이밍에 반영.
</일정>

<최근_먹은_음식>
${JSON.stringify(ctx.recentMeals ?? [])}
- 최근 N일 메뉴. 같은 주재료+조리법 조합은 회피.
</최근_먹은_음식>

<출력_형식>
HTML 이메일 본문, 한국어. 아래 구조를 정확히 따를 것. 다른 텍스트(인사말/마무리/메타 설명) 금지.

<h2>오늘 장보기</h2>
- 추가 구매 불필요 시: <p>추가 구매 없음</p> 한 줄로 끝낼 것 (가능하면 이쪽 우선).
- 필요 시: <ul>에 식재료 목록, 그 아래 <p>로 어떤 메뉴(오늘 저녁/내일 예상)를 위해 사는지 한 줄 맥락.

<h2>아침</h2> / <h2>점심</h2> / <h2>저녁</h2> 각각:
  <p><strong>추천 시간:</strong> HH:MM — [한 줄 이유. 예: 운동 1시간 전 가벼운 탄수화물 / 약속 12:30 고려해 11:30 식사].</p>
  <p><strong>방향성:</strong> 한 줄 요약 (예: 운동 후 단백질 위주).</p>
  <p><strong>추천 메뉴 2가지:</strong></p>
  <ul>
    <li>
      <strong>[요리|배달|외식] 메뉴명</strong>
      <p>선택 이유: 1줄.</p>
      <!-- 요리일 때 -->
      <p>재료: ...</p>
      <p>요리법:</p>
      <ol><li>...</li><li>...</li><li>...</li></ol>  <!-- 3~5단계 -->
      <!-- 배달/외식일 때 -->
      <p>가게/체인 예시: ...</p>
      <p>추천 옵션/주문 팁: ...</p>
    </li>
    <li>두 번째 추천도 같은 형식.</li>
  </ul>

방식 다양성 규칙: 해당 끼니에 허용된 modes 가 2개 이상이면 추천 2개를 가능한 한 서로 다른 방식으로 구성 (예: 요리 1 + 배달 1).
</출력_형식>

<체크리스트>
응답 전 자체 검증:
1. 모든 추천이 "preference.modes" 안에 있는가?
2. "recentMeals" 와 중복되는 메뉴가 없는가?
3. 알레르기/제한 식품을 포함하지 않았는가?
4. 아침/점심 요리 추천이 냉장고 재고 + 기본 조미료만 쓰는가?
5. 각 끼니에 추천 시간 + 이유 + 방향성 + 추천 2가지가 모두 있는가?
6. 출력이 HTML 외 불필요한 텍스트를 포함하지 않는가?
</체크리스트>`;
}
