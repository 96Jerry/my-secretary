// Appendix A-2 전문. 임의 수정·요약 금지. raw_situation 자리만 변수 치환.
export function buildRewriteSituationPrompt(rawSituation: string): string {
  return `## Objective
사용자가 입력한 원본 현재 상황 텍스트를 메인 프롬프트가 활용할 수 있도록 자산 / 격차 / 시간 컨텍스트로 분리된 명세로 재작성한다.

## Input
<raw_situation>
${rawSituation}
</raw_situation>

## Task
1. 자산(asset) 추출: 경력, 보유 기술, 완료한 마일스톤, 진행 중인 활동.
2. 격차(gap) 추출: 부족한 역량, 공백 기간, 미달성 항목.
3. 시간 컨텍스트 추출: 누적 경력 / 공백 기간 / 현재 단계.
4. 입력에 명시되지 않은 항목은 "[명시되지 않음]"으로 표기한다. 추측하여 채우지 않는다.

## Output Format
사족 없이 아래 형식으로만 출력. 마크다운 코드 블록 사용 금지.

자산:
- [자산 1]
- [자산 2]
(있는 만큼)

격차:
- [격차 1]
- [격차 2]
(있는 만큼)

시간 컨텍스트:
- 누적 경력: [기간 또는 "[명시되지 않음]"]
- 공백 기간: [기간 또는 "[명시되지 않음]"]
- 현재 단계: [단계 또는 "[명시되지 않음]"]

## Constraints
- 입력에 없는 정보를 추측하여 추가하지 않는다.
- 한국어로만 출력한다.
`;
}
