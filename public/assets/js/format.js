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

// 초 → "2시간 5분"
export function duration(sec) {
  const m = Math.floor(sec / 60);
  if (m < 1) return '1분 미만';
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}분`;
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}

const KST_TIME = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const KST_DAY = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });

// "11. 17. (월) 20:30 – 22:00". 진행 중이면 끝 시각 대신 "지금"
export function timeRange(startIso, endIso) {
  const start = new Date(startIso);
  return `${KST_DAY.format(start)} ${KST_TIME.format(start)} – ${endIso ? KST_TIME.format(new Date(endIso)) : '지금'}`;
}
