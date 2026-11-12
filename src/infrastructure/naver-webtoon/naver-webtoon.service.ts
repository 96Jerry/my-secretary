import { setTimeout as delay } from 'node:timers/promises';

import { Injectable, Logger } from '@nestjs/common';

// 네이버 웹툰 프런트엔드가 쓰는 공개 API. 인증·쿠키 없이 조회된다.
// 찜 수는 공식 UI 정렬에 없을 뿐, 상세 API가 숫자로 그대로 내려준다.
const TITLE_LIST_URL = 'https://comic.naver.com/api/webtoon/titlelist/weekday';
const ARTICLE_INFO_URL = 'https://comic.naver.com/api/article/list/info';

const HEADERS: Record<string, string> = {
  'User-Agent': 'my-secretary-bot/1.0 (personal webtoon ranking)',
  Accept: 'application/json',
};

// 800여 개 작품을 상세 조회하므로 차단되지 않게 보수적으로 잡는다.
const CONCURRENCY = 12;
const MAX_RETRIES = 3;
// 지수 백오프 기준값. 300ms → 600ms → 1200ms
const RETRY_BASE_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 10_000;

// 상세 API가 한글 장르명을 직접 주므로 이 매핑은 fallback 용도다.
const GENRE_CODE_TO_NAME: Readonly<Record<string, string>> = {
  DAILY: '일상',
  COMIC: '개그',
  FANTASY: '판타지',
  ACTION: '액션',
  DRAMA: '드라마',
  PURE: '순정',
  SENSIBILITY: '감성',
  THRILL: '스릴러',
  HISTORICAL: '무협/사극',
  SPORTS: '스포츠',
};

const UNKNOWN_GENRE = { code: 'ETC', name: '기타' } as const;

export interface NaverWebtoon extends TitleInfo {
  favoriteCount: number;
  genreCode: string;
  genreName: string;
}

export interface NaverWebtoonCrawlResult {
  items: NaverWebtoon[];
  // 상세 조회 실패 또는 찜 수 누락으로 빠진 작품 수
  failed: number;
}

// 목록 API에서 바로 얻는 값. 상세 조회 없이 받으므로 요청 수가 늘지 않는다.
export interface TitleInfo {
  titleId: number;
  titleName: string;
  author: string | null;
  thumbnailUrl: string | null;
  starScore: number | null;
  isRest: boolean;
  isNew: boolean;
}

// 목록 API 응답 중 쓰는 필드만 추렸다
interface TitleListItem {
  titleId: number;
  titleName: string;
  author?: string;
  thumbnailUrl?: string;
  starScore?: unknown;
  rest?: boolean;
  new?: boolean;
}

// 상세 API 응답 중 쓰는 필드만 추렸다
interface ArticleInfoResponse {
  favoriteCount?: unknown;
  curationTagList?: Array<{ tagName?: string; curationType?: string }>;
  gfpAdCustomParam?: { genreTypes?: string[] };
}

class NonRetryableError extends Error {}

@Injectable()
export class NaverWebtoonService {
  private readonly logger = new Logger(NaverWebtoonService.name);

  /** 연재 중인 전 작품의 찜 수·장르. 개별 작품 실패는 건너뛰고 개수만 센다. */
  async fetchAllFavorites(): Promise<NaverWebtoonCrawlResult> {
    const titles = await this.fetchTitleList();
    const details = await mapWithConcurrency(titles, CONCURRENCY, (title) =>
      this.fetchDetail(title),
    );
    const items = details.filter((d): d is NaverWebtoon => d !== null);
    return { items, failed: titles.length - items.length };
  }

  // 요일별 목록에는 여러 요일에 연재되는 작품이 중복으로 들어 있다
  private async fetchTitleList(): Promise<TitleInfo[]> {
    const data = (await this.fetchJson(TITLE_LIST_URL)) as {
      titleListMap?: Record<string, TitleListItem[] | undefined>;
    };

    const unique = new Map<number, TitleInfo>();
    for (const list of Object.values(data.titleListMap ?? {})) {
      for (const t of list ?? []) {
        if (unique.has(t.titleId)) continue;
        unique.set(t.titleId, {
          titleId: t.titleId,
          titleName: t.titleName,
          author: t.author || null,
          thumbnailUrl: t.thumbnailUrl || null,
          starScore: typeof t.starScore === 'number' ? t.starScore : null,
          isRest: t.rest === true,
          isNew: t.new === true,
        });
      }
    }
    return [...unique.values()];
  }

  private async fetchDetail(title: TitleInfo): Promise<NaverWebtoon | null> {
    try {
      const info = (await this.fetchJson(
        `${ARTICLE_INFO_URL}?titleId=${title.titleId}`,
      )) as ArticleInfoResponse;
      if (typeof info.favoriteCount !== 'number') {
        this.logger.warn(`찜 수 누락: ${title.titleName} (${title.titleId})`);
        return null;
      }
      const genre = extractGenre(info);
      return {
        ...title,
        favoriteCount: info.favoriteCount,
        genreCode: genre.code,
        genreName: genre.name,
      };
    } catch (e) {
      this.logger.warn(
        `웹툰 상세 조회 실패: ${title.titleName} (${title.titleId}) - ${(e as Error).message}`,
      );
      return null;
    }
  }

  // 4xx는 재시도해도 결과가 같으므로 즉시 실패. 429와 5xx, 네트워크 오류만 재시도한다.
  private async fetchJson(url: string): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          headers: HEADERS,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) return await res.json();

        const error = new Error(`네이버 응답 실패: HTTP ${res.status}`);
        if (res.status !== 429 && res.status < 500) {
          throw new NonRetryableError(error.message);
        }
        lastError = error;
      } catch (e) {
        if (e instanceof NonRetryableError) throw e;
        lastError = e;
      }

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
    throw lastError;
  }
}

// API의 한글 장르명을 우선 쓰고, 없으면 광고 파라미터의 장르 코드로 대신한다
function extractGenre(info: ArticleInfoResponse): {
  code: string;
  name: string;
} {
  const tag = info.curationTagList?.find((t) =>
    t.curationType?.startsWith('GENRE_'),
  );
  if (tag?.curationType && tag.tagName) {
    return { code: tag.curationType.replace('GENRE_', ''), name: tag.tagName };
  }

  const code = info.gfpAdCustomParam?.genreTypes?.[0];
  if (code) return { code, name: GENRE_CODE_TO_NAME[code] ?? code };

  return { ...UNKNOWN_GENRE };
}

// 외부 패키지 없이 동시 실행 수를 제한한다. 끝나는 대로 다음 작업을 집어간다.
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runNext = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext),
  );
  return results;
}
