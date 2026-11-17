import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  GameSession,
  PlayingActivity,
} from '../domain/game-session.entity.js';
import {
  GAME_SESSION_REPOSITORY,
  type GameSessionRepository,
} from '../domain/game-session.repository.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// 디스코드가 알려준 게임 시작 시각은 이 범위 안일 때만 믿는다
const MAX_BACKDATE = DAY;
// 상태가 잠깐 끊겼다 돌아온 경우 새 세션 대신 직전 세션을 이어 붙인다
const FLICKER_GAP = 2 * MINUTE;
const MAX_DAILY_DAYS = 366;
const RECENT_LIMIT = 30;

export interface GameTotal {
  gameName: string;
  seconds: number;
  sessions: number;
  lastPlayedAt: string;
}

export interface DailyPlay {
  date: string;
  seconds: number;
  games: Record<string, number>;
}

export interface GameSessionView {
  id: string;
  gameName: string;
  startedAt: string;
  endedAt: string | null;
  seconds: number;
}

export interface GameSummary {
  days: number | null;
  fromDate: string | null;
  toDate: string;
  totalSeconds: number;
  totals: GameTotal[];
  daily: DailyPlay[];
  recent: GameSessionView[];
  nowPlaying: GameSessionView[];
}

@Injectable()
export class GameLogService {
  // 여러 서버에서 같은 상태 이벤트가 동시에 들어와도 순서대로 반영한다
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(GAME_SESSION_REPOSITORY)
    private readonly repo: GameSessionRepository,
  ) {}

  /**
   * 지금 하는 게임 목록을 받아 세션을 열고 닫는다.
   * afterDowntime은 봇이 막 켜졌을 때. 그사이 끝난 게임은 마지막 확인 시각에 끝난 것으로 본다.
   */
  sync(
    playing: PlayingActivity[],
    at = new Date(),
    { afterDowntime = false } = {},
  ): Promise<void> {
    return this.enqueue(() => this.apply(playing, at, afterDowntime));
  }

  /** 봇이 살아 있는 동안 진행 중인 세션의 마지막 확인 시각을 갱신한다 */
  heartbeat(at = new Date()): Promise<void> {
    return this.enqueue(async () => {
      const open = await this.repo.findOpen();
      await this.repo.touch(
        open.map((s) => s.id),
        at,
      );
    });
  }

  async summary(rawDays: unknown, now = new Date()): Promise<GameSummary> {
    const days = parseDays(rawDays);
    const toDate = kstDate(now);
    const fromDate = days ? shiftDate(toDate, -(days - 1)) : null;
    const from = fromDate ? kstMidnight(fromDate) : null;
    const sessions = await this.repo.findOverlapping(from, now);

    const totals = new Map<string, GameTotal>();
    const daily = new Map<string, DailyPlay>();
    let totalSeconds = 0;
    for (const s of sessions) {
      const start = from && s.startedAt < from ? from : s.startedAt;
      const end = s.endedAt && s.endedAt < now ? s.endedAt : now;
      if (end <= start) continue;
      const secs = seconds(start, end);
      totalSeconds += secs;
      const t = totals.get(s.gameName) ?? {
        gameName: s.gameName,
        seconds: 0,
        sessions: 0,
        lastPlayedAt: end.toISOString(),
      };
      t.seconds += secs;
      t.sessions += 1;
      if (end.toISOString() > t.lastPlayedAt) {
        t.lastPlayedAt = end.toISOString();
      }
      totals.set(s.gameName, t);
      for (const [date, part] of splitByKstDay(start, end)) {
        const d = daily.get(date) ?? { date, seconds: 0, games: {} };
        d.seconds += part;
        d.games[s.gameName] = (d.games[s.gameName] ?? 0) + part;
        daily.set(date, d);
      }
    }

    return {
      days,
      fromDate,
      toDate,
      totalSeconds,
      totals: [...totals.values()].sort((a, b) => b.seconds - a.seconds),
      daily: fillDays(daily, fromDate, toDate),
      // 봇이 꺼져 있어 길이를 알 수 없게 된 세션(시작=끝)은 목록에서 뺀다
      recent: sessions
        .filter((s) => s.endedAt === null || s.endedAt > s.startedAt)
        .slice(0, RECENT_LIMIT)
        .map((s) => toView(s, now)),
      nowPlaying: sessions
        .filter((s) => s.endedAt === null)
        .map((s) => toView(s, now)),
    };
  }

  // 잘못 잡힌 기록을 지우는 용도
  async remove(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundException('기록을 찾을 수 없습니다.');
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async apply(
    playing: PlayingActivity[],
    at: Date,
    afterDowntime: boolean,
  ): Promise<void> {
    const current = new Map<string, PlayingActivity>();
    for (const a of playing) {
      const name = a.name.trim().slice(0, 200);
      if (name && !current.has(name)) current.set(name, { ...a, name });
    }

    const kept: string[] = [];
    const openNames = new Set<string>();
    for (const s of await this.repo.findOpen()) {
      if (current.has(s.gameName) && !openNames.has(s.gameName)) {
        openNames.add(s.gameName);
        kept.push(s.id);
        continue;
      }
      await this.repo.close(s.id, afterDowntime ? s.lastSeenAt : at);
    }
    await this.repo.touch(kept, at);

    for (const a of current.values()) {
      if (openNames.has(a.name)) continue;
      const startedAt = trustedStart(a.startedAt, at);
      const last = await this.repo.findLastClosed(a.name);
      if (
        last?.endedAt &&
        (at.getTime() - last.endedAt.getTime() <= FLICKER_GAP ||
          last.endedAt > startedAt)
      ) {
        await this.repo.reopen(last.id, at);
        continue;
      }
      await this.repo.open({
        gameName: a.name,
        applicationId: a.applicationId,
        startedAt,
        lastSeenAt: at,
      });
    }
  }
}

function trustedStart(startedAt: Date | null, at: Date): Date {
  if (!startedAt) return at;
  const diff = at.getTime() - startedAt.getTime();
  return diff >= 0 && diff <= MAX_BACKDATE ? startedAt : at;
}

function parseDays(raw: unknown): number | null {
  if (raw === undefined || raw === '' || raw === 'all') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 3650) {
    throw new BadRequestException(
      'days는 1~3650 사이 정수나 all이어야 합니다.',
    );
  }
  return n;
}

function toView(s: GameSession, now: Date): GameSessionView {
  return {
    id: s.id,
    gameName: s.gameName,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    seconds: seconds(s.startedAt, s.endedAt ?? now),
  };
}

const seconds = (a: Date, b: Date) =>
  Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));

const KST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const kstDate = (d: Date) => KST_DATE.format(d);
const kstMidnight = (date: string) => new Date(`${date}T00:00:00+09:00`);

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 자정(KST)을 넘는 세션을 날짜별 초로 나눈다 */
export function splitByKstDay(start: Date, end: Date): [string, number][] {
  const parts: [string, number][] = [];
  let cursor = start;
  while (cursor < end) {
    const date = kstDate(cursor);
    const next = kstMidnight(shiftDate(date, 1));
    const stop = next < end ? next : end;
    parts.push([date, seconds(cursor, stop)]);
    cursor = stop;
  }
  return parts;
}

function fillDays(
  daily: Map<string, DailyPlay>,
  fromDate: string | null,
  toDate: string,
): DailyPlay[] {
  const earliest = [...daily.keys()].sort()[0] ?? toDate;
  let start = fromDate ?? earliest;
  const floor = shiftDate(toDate, -(MAX_DAILY_DAYS - 1));
  if (start < floor) start = floor;
  const out: DailyPlay[] = [];
  for (let d = start; d <= toDate; d = shiftDate(d, 1)) {
    out.push(daily.get(d) ?? { date: d, seconds: 0, games: {} });
  }
  return out;
}
