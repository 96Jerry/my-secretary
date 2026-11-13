// 화면 표기. 코드 값은 서버의 열람 기록(webtoon-log.entity.ts)과 같다
export const PLATFORMS = { naver: '네이버웹툰', kakaopage: '카카오페이지', kakaowebtoon: '카카오웹툰', ridi: '리디', lezhin: '레진', bomtoon: '봄툰', etc: '기타' };
export const STATUSES = { reading: '보는 중', completed: '완독', paused: '보류', dropped: '하차' };
export const VERDICTS = { best: '인생작', good: '재밌음', okay: '보통', bad: '별로', worst: '최악 (쳐다보기도 싫음)' };
export const VERDICT_SHORT = { ...VERDICTS, worst: '최악' };

// 붙여넣기에서 알아듣는 표기. 공백은 무시하고 비교한다
export const ALIASES = {
  platform: { 네이버: 'naver', 네웹: 'naver', 네이버웹툰: 'naver', naver: 'naver', 카카오페이지: 'kakaopage', 카페: 'kakaopage', 카카페: 'kakaopage', kakaopage: 'kakaopage', 카카오웹툰: 'kakaowebtoon', 카웹: 'kakaowebtoon', kakaowebtoon: 'kakaowebtoon', 리디: 'ridi', 리디북스: 'ridi', ridi: 'ridi', 레진: 'lezhin', 레진코믹스: 'lezhin', lezhin: 'lezhin', 봄툰: 'bomtoon', bomtoon: 'bomtoon', 기타: 'etc', etc: 'etc' },
  status: { 보는중: 'reading', 연재중: 'reading', reading: 'reading', 완독: 'completed', 완결: 'completed', completed: 'completed', 보류: 'paused', paused: 'paused', 하차: 'dropped', dropped: 'dropped' },
  verdict: { 인생작: 'best', best: 'best', 재밌음: 'good', 재미있음: 'good', good: 'good', 보통: 'okay', okay: 'okay', 별로: 'bad', bad: 'bad', 최악: 'worst', worst: 'worst' },
};
