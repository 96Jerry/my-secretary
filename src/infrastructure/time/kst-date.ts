// Asia/Seoul 기준 YYYY-MM-DD. en-CA 로케일은 항상 ISO 형식 출력.
// toISOString()은 UTC 기준이라 KST 00:00~09:00 사이에 전날 날짜가 나오므로 사용 금지.
export function todayKstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
