// 독점 작품이 많아 플랫폼을 함께 기록한다. 네이버만 찜 순위 데이터와 연결된다.
export const WEBTOON_PLATFORMS = [
  'naver',
  'kakaopage',
  'kakaowebtoon',
  'ridi',
  'lezhin',
  'bomtoon',
  'etc',
] as const;
export type WebtoonPlatform = (typeof WEBTOON_PLATFORMS)[number];

// 어디까지 봤는가 (진행 상태)
export const READ_STATUSES = [
  'reading',
  'completed',
  'paused',
  'dropped',
] as const;
export type ReadStatus = (typeof READ_STATUSES)[number];

// 어땠는가 (평가). 재미없던 작품도 다시 손대지 않도록 남긴다. worst는 쳐다보기도 싫은 수준
export const VERDICTS = ['best', 'good', 'okay', 'bad', 'worst'] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface WebtoonLogInput {
  title: string;
  platform: WebtoonPlatform;
  // 네이버 작품이면 찜 순위 스냅샷의 titleId. 완결 등으로 못 찾으면 null
  naverTitleId: number | null;
  // 마지막으로 본 회차. 모르면 null
  episode: number | null;
  status: ReadStatus;
  verdict: Verdict | null;
  memo: string | null;
  // 작품 페이지 주소. 네이버 주소면 titleId로 순위와 연결한다 (완결작도 연결된다)
  url: string | null;
  // 마지막으로 본 날짜(YYYY-MM-DD). 예전에 봐서 모르면 null
  lastReadAt: string | null;
}

// 사용자는 본인 한 명이라 사용자 구분 없이 둔다
export interface WebtoonLog extends WebtoonLogInput {
  id: string;
  updatedAt: Date;
}

// 회차·상태·평가가 바뀔 때마다 남기는 이력. "언제 어디까지 봤는지"를 시간순으로 본다
export interface WebtoonLogHistoryEntry {
  episode: number | null;
  status: ReadStatus;
  verdict: Verdict | null;
  readAt: string | null;
  recordedAt: Date;
}
