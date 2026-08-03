import { Injectable, Logger } from '@nestjs/common';

const NEWS_API_URL =
  'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/';

export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  // 출처 피드. 개발사 공지는 'steam_community_announcements',
  // 언론 기사는 'PCGamesN' 같은 매체명이 들어온다.
  feedname: string;
}

@Injectable()
export class SteamNewsService {
  private readonly logger = new Logger(SteamNewsService.name);

  /**
   * Steam 뉴스 API에서 최신 글 목록을 조회. 응답 형태가 예상과 다르면 빈 배열.
   * HTTP 실패는 throw — 호출부(cron job)에서 catch해 로깅한다.
   */
  async fetchNews(appId: number, count: number): Promise<SteamNewsItem[]> {
    const url = `${NEWS_API_URL}?appid=${appId}&count=${count}&maxlength=0`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Steam 뉴스 API 응답 실패: ${res.status} ${res.statusText}`,
      );
    }

    const body: unknown = await res.json();
    const items = readNewsItems(body);
    if (!items) {
      this.logger.warn('Steam 뉴스 API 응답 형태가 예상과 다름 — 빈 목록 반환');
      return [];
    }
    return items;
  }
}

function readNewsItems(body: unknown): SteamNewsItem[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const appnews = (body as { appnews?: unknown }).appnews;
  if (typeof appnews !== 'object' || appnews === null) return null;
  const raw = (appnews as { newsitems?: unknown }).newsitems;
  if (!Array.isArray(raw)) return null;

  const items: SteamNewsItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { gid, title, url, feedname } = entry as Record<string, unknown>;
    // gid가 없으면 중복 판단이 불가하므로 스킵
    if (typeof gid !== 'string' || gid === '') continue;
    items.push({
      gid,
      title: typeof title === 'string' ? title : '(제목 없음)',
      url: typeof url === 'string' ? url : '',
      feedname: typeof feedname === 'string' ? feedname : '',
    });
  }
  return items;
}
