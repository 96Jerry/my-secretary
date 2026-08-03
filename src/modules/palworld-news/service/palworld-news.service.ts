import { Inject, Injectable, Logger } from '@nestjs/common';

import { EnvironmentVariables } from '@config/index.js';
import { MailService } from '@infra/mail/mail.service.js';
import {
  SteamNewsItem,
  SteamNewsService,
} from '@infra/steam/steam-news.service.js';
import {
  PALWORLD_NEWS_REPOSITORY,
  type PalworldNewsRepository,
} from '../domain/palworld-news.repository.js';

const PALWORLD_APP_ID = 1623730;
// Steam 뉴스 피드에는 개발사 공지와 언론 기사(PCGamesN 등)가 섞여 내려온다.
// 패치노트는 개발사 공지로만 올라오므로 해당 피드만 보고, 기사에 밀려 공지가
// 조회 범위 밖으로 벗어나지 않도록 넉넉히 받는다.
const FETCH_COUNT = 20;
const ANNOUNCEMENT_FEED = 'steam_community_announcements';

@Injectable()
export class PalworldNewsService {
  private readonly logger = new Logger(PalworldNewsService.name);

  constructor(
    @Inject(PALWORLD_NEWS_REPOSITORY)
    private readonly newsRepo: PalworldNewsRepository,
    private readonly steamNewsService: SteamNewsService,
    private readonly mailService: MailService,
    private readonly env: EnvironmentVariables,
  ) {}

  async checkForNewPosts(): Promise<void> {
    const fetched = await this.steamNewsService.fetchNews(
      PALWORLD_APP_ID,
      FETCH_COUNT,
    );
    const items = fetched.filter((item) => item.feedname === ANNOUNCEMENT_FEED);
    if (items.length === 0) return;

    // 최초 기동: 과거 패치노트가 한꺼번에 발송되지 않도록 알림 없이 저장만 한다.
    if (await this.newsRepo.isEmpty()) {
      await this.newsRepo.saveGids(items.map((item) => item.gid));
      this.logger.log(`팰월드 패치노트 초기 동기화: ${items.length}건 저장`);
      return;
    }

    const known = await this.newsRepo.findKnownGids(
      items.map((item) => item.gid),
    );
    const fresh = items.filter((item) => !known.has(item.gid));
    // 1분 주기로 도는 잡이므로 새 글이 없는 경우엔 로그를 남기지 않는다.
    if (fresh.length === 0) return;

    await this.mailService.send({
      to: this.env.PALWORLD_NEWS_RECIPIENT,
      subject: `팰월드 새 패치노트 ${fresh.length}건`,
      html: toHtml(fresh),
    });

    // 발송에 성공한 뒤에 저장해야, 실패 시 다음 주기에 재시도된다.
    await this.newsRepo.saveGids(fresh.map((item) => item.gid));

    this.logger.log(
      `팰월드 새 패치노트 발송 완료: ${fresh.map((item) => item.title).join(', ')}`,
    );
  }
}

function toHtml(items: SteamNewsItem[]): string {
  const list = items
    .map((item) => {
      const title = escapeHtml(item.title);
      return item.url
        ? `<li><a href="${escapeHtml(item.url)}">${title}</a></li>`
        : `<li>${title}</li>`;
    })
    .join('');
  return `<p>새 팰월드 패치가 올라왔습니다.</p><ul>${list}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
