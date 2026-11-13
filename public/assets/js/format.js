// 숫자·날짜 표기. DOM을 쓰지 않는다
export const fmt = new Intl.NumberFormat('ko-KR');
export const signed = (n) => (n > 0 ? '+' : '') + fmt.format(n);
export const pct = (r) => (r > 0 ? '+' : '') + (r * 100).toFixed(r !== 0 && Math.abs(r) < 0.01 ? 2 : 1) + '%';

export const todayKst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export function ago(iso, today = todayKst()) {
  if (!iso) return '날짜 모름';
  const days = Math.floor((Date.parse(today) - Date.parse(iso)) / 86400000);
  if (days <= 0) return '오늘';
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export function shiftDate(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
