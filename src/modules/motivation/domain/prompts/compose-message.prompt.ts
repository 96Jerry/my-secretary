// Appendix A-3 전문. 임의 수정·요약 금지. 4개 자리만 변수 치환.
export interface ComposeMessageInput {
  rewrittenGoal: string;
  rewrittenSituation: string;
  daysNotStudied: number;
  // 첫 실행이면 "없음"으로 전달.
  previousOutput: string;
}

export function buildComposeMessagePrompt(input: ComposeMessageInput): string {
  return `## Objective
재작성된 목표, 재작성된 현재 상황, 공부하지 않은 일수, 이전 출력값을 입력받아 행동 변화를 유도하는 동기부여 메시지 한 편을 생성한다.

## Input
<rewritten_goal>
${input.rewrittenGoal}
</rewritten_goal>

<rewritten_situation>
${input.rewrittenSituation}
</rewritten_situation>

<days_not_studied>
${input.daysNotStudied}
</days_not_studied>

<previous_output>
${input.previousOutput}
</previous_output>

## Task
1. 매일 공부하는 가상의 비교 대상("다른 사람")을 기준점으로 설정한다. 평균 하루 학습 시간 2시간을 기본 가정으로 한다.
2. 공부하지 않은 일수 × 2시간으로 누적 격차를 정량화한다.
3. 각 목표별로 백분율(%)을 추정 산출한다:
   - 다른 사람의 현재 진척도 (재작성된 목표의 추정 소요 기간 대비 누적 학습량)
   - 사용자의 현재 진척도 (재작성된 현재 상황의 자산을 근거로)
   - 두 값의 차이
4. 산출은 추정임을 한 번 명시한다 (예: "기준값 기반 추정으로").
5. 메시지 끝은 사용자가 격차를 좁힐 수 있다는 격려로 마무리한다.

## Output Format
- 어조: 직설적이고 비교 자극을 주는 "tough love" 스타일. 마지막은 반드시 격려로 종료.
- 분량: 4~6 문단의 줄글. 한국어.
- 마크다운 헤더 / 불릿 / 코드 블록 사용 금지.
- 다음 5요소를 모두 포함:
  1. "다른 사람은 매일 공부합니다" 류의 비교 진술
  2. 공부하지 않은 일수와 누적 격차의 정량 묘사
  3. 다른 사람의 목표 달성률 (% 표기)
  4. 사용자의 목표 달성률 (% 표기)
  5. "당신도 할 수 있습니다" 류의 격려 마무리
- 모든 백분율은 숫자로 명시한다 (예: "73%").

## Constraints
- 백분율은 입력 데이터를 근거로 추정한다. 근거 없는 숫자 생성 금지.
- previous_output이 "없음"이 아니면, 그 메시지와 동일한 비유 / 문장 시작 / 어휘 조합을 반복하지 않는다. 표현을 새로 한다.
- 인신공격 금지. 비판은 행동(공부 안한 일수)에만 향한다. 사람 자체나 공백기 자체를 비난하지 않는다.
- 자해 / 자살 / 극단적 선택 관련 표현·비유 금지.
- 한국어로만 출력한다.
- 마지막 문단은 반드시 격려로 끝낸다.
`;
}
