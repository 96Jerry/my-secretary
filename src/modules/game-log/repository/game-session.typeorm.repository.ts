import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

import type {
  GameSession,
  NewGameSession,
} from '../domain/game-session.entity.js';
import type { GameSessionRepository } from '../domain/game-session.repository.js';
import { GameSessionOrmEntity } from './game-session.orm-entity.js';

@Injectable()
export class GameSessionTypeormRepository implements GameSessionRepository {
  constructor(
    @InjectRepository(GameSessionOrmEntity)
    private readonly sessions: Repository<GameSessionOrmEntity>,
  ) {}

  async findOpen(): Promise<GameSession[]> {
    const rows = await this.sessions.find({ where: { endedAt: IsNull() } });
    return rows.map(toDomain);
  }

  async findOverlapping(from: Date | null, to: Date): Promise<GameSession[]> {
    const qb = this.sessions
      .createQueryBuilder('s')
      .where('s.startedAt < :to', { to });
    if (from) {
      qb.andWhere('(s.endedAt IS NULL OR s.endedAt > :from)', { from });
    }
    const rows = await qb.orderBy('s.startedAt', 'DESC').getMany();
    return rows.map(toDomain);
  }

  async open(session: NewGameSession): Promise<GameSession> {
    const row = await this.sessions.save(
      this.sessions.create({ ...session, endedAt: null }),
    );
    return toDomain(row);
  }

  async findLastClosed(gameName: string): Promise<GameSession | null> {
    const row = await this.sessions.findOne({
      where: { gameName, endedAt: Not(IsNull()) },
      order: { endedAt: 'DESC' },
    });
    return row ? toDomain(row) : null;
  }

  async reopen(id: string, at: Date): Promise<void> {
    await this.sessions.update({ id }, { endedAt: null, lastSeenAt: at });
  }

  async close(id: string, endedAt: Date): Promise<void> {
    await this.sessions.update({ id }, { endedAt, lastSeenAt: endedAt });
  }

  async touch(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.sessions.update({ id: In(ids) }, { lastSeenAt: at });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.sessions.delete({ id });
    return !!result.affected;
  }
}

function toDomain(r: GameSessionOrmEntity): GameSession {
  return {
    id: r.id,
    gameName: r.gameName,
    applicationId: r.applicationId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    lastSeenAt: r.lastSeenAt,
  };
}
