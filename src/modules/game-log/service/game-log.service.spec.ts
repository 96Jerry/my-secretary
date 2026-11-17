import { BadRequestException } from '@nestjs/common';

import type {
  GameSession,
  NewGameSession,
} from '../domain/game-session.entity.js';
import type { GameSessionRepository } from '../domain/game-session.repository.js';
import { GameLogService, splitByKstDay } from './game-log.service.js';

/** 메모리 저장소 대역 */
class FakeRepository implements GameSessionRepository {
  readonly rows: GameSession[] = [];
  private seq = 0;

  findOpen(): Promise<GameSession[]> {
    return Promise.resolve(this.rows.filter((s) => s.endedAt === null));
  }

  findOverlapping(from: Date | null, to: Date): Promise<GameSession[]> {
    return Promise.resolve(
      this.rows
        .filter(
          (s) =>
            s.startedAt < to &&
            (!from || s.endedAt === null || s.endedAt > from),
        )
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()),
    );
  }

  findLastClosed(gameName: string): Promise<GameSession | null> {
    const closed = this.rows
      .filter((s) => s.gameName === gameName && s.endedAt)
      .sort((a, b) => b.endedAt!.getTime() - a.endedAt!.getTime());
    return Promise.resolve(closed[0] ?? null);
  }

  open(s: NewGameSession): Promise<GameSession> {
    const row = { ...s, id: `s${++this.seq}`, endedAt: null };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  close(id: string, endedAt: Date): Promise<void> {
    const row = this.get(id);
    row.endedAt = endedAt;
    row.lastSeenAt = endedAt;
    return Promise.resolve();
  }

  reopen(id: string, at: Date): Promise<void> {
    const row = this.get(id);
    row.endedAt = null;
    row.lastSeenAt = at;
    return Promise.resolve();
  }

  touch(ids: string[], at: Date): Promise<void> {
    for (const id of ids) this.get(id).lastSeenAt = at;
    return Promise.resolve();
  }

  delete(id: string): Promise<boolean> {
    const i = this.rows.findIndex((s) => s.id === id);
    if (i < 0) return Promise.resolve(false);
    this.rows.splice(i, 1);
    return Promise.resolve(true);
  }

  private get(id: string): GameSession {
    const row = this.rows.find((s) => s.id === id);
    if (!row) throw new Error(`no ${id}`);
    return row;
  }
}

const t = (iso: string) => new Date(iso);
const game = (name: string, startedAt: Date | null = null) => ({
  name,
  applicationId: null,
  startedAt,
});

describe('GameLogService', () => {
  let repo: FakeRepository;
  let service: GameLogService;

  beforeEach(() => {
    repo = new FakeRepository();
    service = new GameLogService(repo);
  });

  describe('sync', () => {
    it('게임을 켜면 디스코드가 알려준 시작 시각으로 세션을 연다', async () => {
      await service.sync(
        [game('Palworld', t('2026-11-17T10:00:00Z'))],
        t('2026-11-17T10:01:00Z'),
      );
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({
        gameName: 'Palworld',
        startedAt: t('2026-11-17T10:00:00Z'),
        endedAt: null,
      });
    });

    it('하루보다 오래된 시작 시각은 믿지 않고 받은 시각을 쓴다', async () => {
      await service.sync(
        [game('Palworld', t('2026-11-10T00:00:00Z'))],
        t('2026-11-17T10:00:00Z'),
      );
      expect(repo.rows[0].startedAt).toEqual(t('2026-11-17T10:00:00Z'));
    });

    it('게임을 끄면 그 시각에 세션을 닫는다', async () => {
      await service.sync([game('Palworld')], t('2026-11-17T10:00:00Z'));
      await service.sync([], t('2026-11-17T11:30:00Z'));
      expect(repo.rows[0].endedAt).toEqual(t('2026-11-17T11:30:00Z'));
    });

    it('계속 하는 중이면 새로 열지 않고 확인 시각만 갱신한다', async () => {
      await service.sync([game('Palworld')], t('2026-11-17T10:00:00Z'));
      await service.sync(
        [game('Palworld'), game('Palworld')],
        t('2026-11-17T10:10:00Z'),
      );
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].lastSeenAt).toEqual(t('2026-11-17T10:10:00Z'));
    });

    it('봇이 꺼져 있던 동안 끝난 게임은 마지막 확인 시각에 닫는다', async () => {
      await service.sync([game('Palworld')], t('2026-11-17T10:00:00Z'));
      await service.heartbeat(t('2026-11-17T10:20:00Z'));
      await service.sync([], t('2026-11-17T15:00:00Z'), {
        afterDowntime: true,
      });
      expect(repo.rows[0].endedAt).toEqual(t('2026-11-17T10:20:00Z'));
    });

    it('상태가 잠깐 끊겼다 돌아오면 직전 세션을 이어 붙인다', async () => {
      await service.sync([game('Palworld')], t('2026-11-17T10:00:00Z'));
      await service.sync([], t('2026-11-17T10:30:00Z'));
      await service.sync([game('Palworld')], t('2026-11-17T10:31:00Z'));
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].endedAt).toBeNull();
    });

    it('충분히 쉬고 다시 켜면 새 세션이다', async () => {
      await service.sync([game('Palworld')], t('2026-11-17T10:00:00Z'));
      await service.sync([], t('2026-11-17T10:30:00Z'));
      await service.sync([game('Palworld')], t('2026-11-17T12:00:00Z'));
      expect(repo.rows).toHaveLength(2);
    });

    it('동시에 들어온 이벤트도 순서대로 처리해 세션이 겹치지 않는다', async () => {
      const at = t('2026-11-17T10:00:00Z');
      await Promise.all([
        service.sync([game('Palworld')], at),
        service.sync([game('Palworld')], at),
      ]);
      expect(repo.rows).toHaveLength(1);
    });
  });

  describe('summary', () => {
    const now = t('2026-11-17T12:00:00Z'); // KST 21:00

    beforeEach(() => {
      repo.rows.push(
        // KST 11/16 23:00 ~ 11/17 01:00 — 자정을 넘김
        {
          id: 'a',
          gameName: 'Palworld',
          applicationId: null,
          startedAt: t('2026-11-16T14:00:00Z'),
          endedAt: t('2026-11-16T16:00:00Z'),
          lastSeenAt: t('2026-11-16T16:00:00Z'),
        },
        // 지금 하는 중. KST 20:30부터
        {
          id: 'b',
          gameName: 'Hades II',
          applicationId: null,
          startedAt: t('2026-11-17T11:30:00Z'),
          endedAt: null,
          lastSeenAt: t('2026-11-17T11:55:00Z'),
        },
        // 범위 밖 (KST 11/1)
        {
          id: 'c',
          gameName: 'Palworld',
          applicationId: null,
          startedAt: t('2026-11-01T01:00:00Z'),
          endedAt: t('2026-11-01T02:00:00Z'),
          lastSeenAt: t('2026-11-01T02:00:00Z'),
        },
      );
    });

    it('게임별·일별로 합산하고 진행 중인 세션은 지금까지 센다', async () => {
      const s = await service.summary('7', now);
      expect(s.fromDate).toBe('2026-11-11');
      expect(s.toDate).toBe('2026-11-17');
      expect(s.totals).toEqual([
        expect.objectContaining({ gameName: 'Palworld', seconds: 7200 }),
        expect.objectContaining({ gameName: 'Hades II', seconds: 1800 }),
      ]);
      expect(s.daily).toHaveLength(7);
      expect(s.daily.at(-2)).toMatchObject({
        date: '2026-11-16',
        seconds: 3600,
      });
      expect(s.daily.at(-1)).toMatchObject({
        date: '2026-11-17',
        seconds: 5400,
        games: { Palworld: 3600, 'Hades II': 1800 },
      });
      expect(s.nowPlaying.map((v) => v.gameName)).toEqual(['Hades II']);
    });

    it('기간 시작 전에 시작한 세션은 시작일 자정부터만 센다', async () => {
      const s = await service.summary('1', now);
      expect(s.totals.find((g) => g.gameName === 'Palworld')?.seconds).toBe(
        3600,
      );
    });

    it('전체 기간이면 첫 기록 날짜부터 채운다', async () => {
      const s = await service.summary('all', now);
      expect(s.days).toBeNull();
      expect(s.daily[0].date).toBe('2026-11-01');
      expect(s.totalSeconds).toBe(3600 + 7200 + 1800);
    });

    it('days 형식이 틀리면 거부한다', async () => {
      await expect(service.summary('0', now)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.summary('abc', now)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  it('splitByKstDay는 KST 자정에서 자른다', () => {
    expect(
      splitByKstDay(t('2026-11-16T14:30:00Z'), t('2026-11-16T15:30:00Z')),
    ).toEqual([
      ['2026-11-16', 1800],
      ['2026-11-17', 1800],
    ]);
  });
});
