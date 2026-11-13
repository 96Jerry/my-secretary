import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { NaverWebtoonService } from '@infra/naver-webtoon/naver-webtoon.service.js';
import { todayKstDate } from '@infra/time/kst-date.js';
import { WebtoonRankingService } from '@modules/webtoon-ranking/service/webtoon-ranking.service.js';
import {
  READ_STATUSES,
  VERDICTS,
  WEBTOON_PLATFORMS,
  type ReadStatus,
  type WebtoonLog,
  type WebtoonLogHistoryEntry,
  type WebtoonLogInput,
} from '../domain/webtoon-log.entity.js';
import {
  WEBTOON_LOG_REPOSITORY,
  type WebtoonLogRepository,
} from '../domain/webtoon-log.repository.js';

export interface WebtoonLogView extends WebtoonLog {
  // 네이버에 공개된 가장 최근 회차. 연결되지 않았거나 조회에 실패하면 null
  latestEpisode: number | null;
  // 그 회차의 공개일, 네이버 표기 그대로 ("26.11.10")
  latestPublishedAt: string | null;
  // 최신 회차 - 본 회차. 계산할 수 없으면 null
  unread: number | null;
}

export interface WebtoonLogImportResult {
  created: number;
  updated: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_URL_LENGTH = 500;
const MAX_IMPORT_ROWS = 500;
// 네이버에 한꺼번에 몰리지 않게 최신 회차 조회를 나눠 보낸다
const LATEST_EPISODE_BATCH = 8;
// 완독·하차한 작품은 밀린 회차를 셀 이유가 없다
const TRACK_UNREAD: ReadonlySet<ReadStatus> = new Set(['reading', 'paused']);

type TitleRef = { titleId: number; titleName: string };

@Injectable()
export class WebtoonLogService {
  private readonly logger = new Logger(WebtoonLogService.name);
  // 최신 회차는 작품별로 하루 한 번만 네이버에 묻는다
  private readonly latestCache = new Map<
    number,
    { date: string; episode: number | null; publishedAt: string | null }
  >();

  constructor(
    @Inject(WEBTOON_LOG_REPOSITORY)
    private readonly repository: WebtoonLogRepository,
    private readonly naverWebtoon: NaverWebtoonService,
    private readonly ranking: WebtoonRankingService,
  ) {}

  async list(): Promise<WebtoonLogView[]> {
    const logs = await this.repository.findAll();
    const today = todayKstDate();
    const stale = [
      ...new Set(
        logs
          .filter((l) => l.naverTitleId !== null && TRACK_UNREAD.has(l.status))
          .map((l) => l.naverTitleId!),
      ),
    ].filter((id) => this.latestCache.get(id)?.date !== today);
    for (let i = 0; i < stale.length; i += LATEST_EPISODE_BATCH) {
      await Promise.all(
        stale
          .slice(i, i + LATEST_EPISODE_BATCH)
          .map((id) => this.refreshLatest(id, today)),
      );
    }

    return logs.map((log) => {
      const latest =
        log.naverTitleId !== null && TRACK_UNREAD.has(log.status)
          ? this.latestCache.get(log.naverTitleId)
          : undefined;
      const latestEpisode = latest?.episode ?? null;
      const unread =
        latestEpisode !== null && log.episode !== null
          ? Math.max(0, latestEpisode - log.episode)
          : null;
      return {
        ...log,
        latestEpisode,
        latestPublishedAt: latest?.publishedAt ?? null,
        unread,
      };
    });
  }

  async create(body: unknown): Promise<WebtoonLog> {
    const input = linkNaver(parseLogInput(body), await this.titles());
    if (await this.repository.findByKey(input.platform, input.title)) {
      throw new ConflictException(`이미 기록한 작품입니다: ${input.title}`);
    }
    const saved = await this.repository.save(input);
    await this.recordHistory(saved, null);
    return saved;
  }

  async update(id: string, body: unknown): Promise<WebtoonLog> {
    const before = await this.repository.findById(id);
    if (!before) throw new NotFoundException('기록이 없습니다');
    const input = linkNaver(parseLogInput(body), await this.titles());
    const same = await this.repository.findByKey(input.platform, input.title);
    if (same && same.id !== id) {
      throw new ConflictException(`이미 기록한 작품입니다: ${input.title}`);
    }
    const saved = await this.repository.save(input, id);
    await this.recordHistory(saved, before);
    return saved;
  }

  /**
   * 여러 작품을 한 번에 등록한다. 같은 플랫폼·제목이 이미 있으면 덮어쓴다.
   * 한 줄이라도 틀리면 아무것도 저장하지 않고 틀린 줄을 모두 알려 준다.
   */
  async importMany(rows: unknown): Promise<WebtoonLogImportResult> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('등록할 작품이 없습니다');
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `한 번에 ${MAX_IMPORT_ROWS}개까지 등록할 수 있습니다`,
      );
    }

    const errors: string[] = [];
    const inputs: WebtoonLogInput[] = [];
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      try {
        const input = parseLogInput(row);
        const key = `${input.platform}\u0000${input.title}`;
        if (seen.has(key)) throw new Error(`중복된 작품: ${input.title}`);
        seen.add(key);
        inputs.push(input);
      } catch (e) {
        errors.push(`${i + 1}번째 줄: ${(e as Error).message}`);
      }
    });
    if (errors.length > 0) throw new BadRequestException(errors);

    const titles = await this.titles();
    let created = 0;
    let updated = 0;
    for (const raw of inputs) {
      const input = linkNaver(raw, titles);
      const before = await this.repository.findByKey(
        input.platform,
        input.title,
      );
      // 띄어쓰기만 다른 제목으로 덮어쓸 때는 기존 표기를 유지한다
      const saved = await this.repository.save(
        before ? { ...input, title: before.title } : input,
        before?.id,
      );
      await this.recordHistory(saved, before);
      if (before) updated++;
      else created++;
    }
    return { created, updated };
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repository.delete(id))) {
      throw new NotFoundException('기록이 없습니다');
    }
  }

  async history(id: string): Promise<WebtoonLogHistoryEntry[]> {
    if (!(await this.repository.findById(id))) {
      throw new NotFoundException('기록이 없습니다');
    }
    return this.repository.findHistory(id);
  }

  private titles(): Promise<TitleRef[]> {
    return this.ranking.getLatestTitles();
  }

  // 진행 상황이 바뀌었을 때만 남긴다. 메모나 제목 수정은 이력에 넣지 않는다
  private async recordHistory(
    after: WebtoonLog,
    before: WebtoonLog | null,
  ): Promise<void> {
    const changed =
      !before ||
      before.episode !== after.episode ||
      before.status !== after.status ||
      before.verdict !== after.verdict ||
      before.lastReadAt !== after.lastReadAt;
    if (!changed) return;
    await this.repository.appendHistory(after.id, {
      episode: after.episode,
      status: after.status,
      verdict: after.verdict,
      readAt: after.lastReadAt,
    });
  }

  private async refreshLatest(titleId: number, today: string): Promise<void> {
    try {
      const { episode, publishedAt } =
        await this.naverWebtoon.fetchLatestEpisode(titleId);
      this.latestCache.set(titleId, { date: today, episode, publishedAt });
    } catch (e) {
      // 실패는 캐시하지 않아 다음 조회 때 다시 시도한다
      this.logger.warn(
        `최신 회차 조회 실패: ${titleId} - ${(e as Error).message}`,
      );
    }
  }
}

/**
 * 네이버 작품을 찜 순위와 연결한다. 직접 준 titleId → 네이버 주소의 titleId →
 * 최신 스냅샷의 제목 순으로 찾는다. 스냅샷엔 연재작만 있어 완결작은 주소로만 연결된다.
 */
function linkNaver(
  input: WebtoonLogInput,
  titles: TitleRef[],
): WebtoonLogInput {
  if (input.platform !== 'naver') return { ...input, naverTitleId: null };
  if (input.naverTitleId !== null) return input;
  const fromUrl = naverTitleIdFromUrl(input.url);
  if (fromUrl !== null) return { ...input, naverTitleId: fromUrl };
  const key = normalizeTitle(input.title);
  const found =
    titles.find((t) => t.titleName === input.title) ??
    titles.find((t) => normalizeTitle(t.titleName) === key);
  return { ...input, naverTitleId: found?.titleId ?? null };
}

// comic.naver.com/webtoon/list?titleId=769209 같은 주소에서 titleId만 뽑는다
function naverTitleIdFromUrl(url: string | null): number | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)comic\.naver\.com$/.test(u.hostname)) return null;
    const id = Number(u.searchParams.get('titleId'));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, '').toLowerCase();
}

function parseLogInput(body: unknown): WebtoonLogInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('기록 형식이 아닙니다');
  }
  const b = body as Record<string, unknown>;
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  const oneOf = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    name: string,
  ): T =>
    allowed.includes(value as T)
      ? (value as T)
      : fail(`${name}은(는) ${allowed.join(', ')} 중 하나여야 합니다`);
  const optionalInt = (value: unknown, name: string): number | null => {
    if (value === null || value === undefined || value === '') return null;
    return Number.isInteger(value) && (value as number) >= 0
      ? (value as number)
      : fail(`${name}은(는) 0 이상의 정수여야 합니다`);
  };

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 200) fail('제목은 1~200자여야 합니다');

  const memo =
    typeof b.memo === 'string' && b.memo.trim() ? b.memo.trim() : null;
  if (memo && memo.length > 1000) fail('메모는 1000자까지입니다');

  const url = typeof b.url === 'string' && b.url.trim() ? b.url.trim() : null;
  if (url && (!/^https?:\/\//i.test(url) || url.length > MAX_URL_LENGTH)) {
    fail(`링크는 http(s)로 시작하는 ${MAX_URL_LENGTH}자 이하 주소여야 합니다`);
  }

  const lastReadAt =
    b.lastReadAt === null || b.lastReadAt === undefined || b.lastReadAt === ''
      ? null
      : typeof b.lastReadAt === 'string' && ISO_DATE.test(b.lastReadAt)
        ? b.lastReadAt
        : fail('날짜는 YYYY-MM-DD 형식이어야 합니다');

  return {
    title,
    platform: oneOf(b.platform, WEBTOON_PLATFORMS, '플랫폼'),
    naverTitleId: optionalInt(b.naverTitleId, 'naverTitleId') || null,
    episode: optionalInt(b.episode, '회차'),
    status:
      b.status === undefined
        ? 'reading'
        : oneOf(b.status, READ_STATUSES, '상태'),
    verdict:
      b.verdict === null || b.verdict === undefined || b.verdict === ''
        ? null
        : oneOf(b.verdict, VERDICTS, '평가'),
    memo,
    url,
    lastReadAt,
  };
}
