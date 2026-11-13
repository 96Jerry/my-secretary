import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  WebtoonLog,
  WebtoonLogHistoryEntry,
  WebtoonLogInput,
  WebtoonPlatform,
} from '../domain/webtoon-log.entity.js';
import type { WebtoonLogRepository } from '../domain/webtoon-log.repository.js';
import { WebtoonLogHistoryOrmEntity } from './webtoon-log-history.orm-entity.js';
import { WebtoonLogOrmEntity } from './webtoon-log.orm-entity.js';

@Injectable()
export class WebtoonLogTypeormRepository implements WebtoonLogRepository {
  constructor(
    @InjectRepository(WebtoonLogOrmEntity)
    private readonly logs: Repository<WebtoonLogOrmEntity>,
    @InjectRepository(WebtoonLogHistoryOrmEntity)
    private readonly history: Repository<WebtoonLogHistoryOrmEntity>,
  ) {}

  async findAll(): Promise<WebtoonLog[]> {
    const rows = await this.logs.find({ order: { updatedAt: 'DESC' } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<WebtoonLog | null> {
    const row = await this.logs.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findByKey(
    platform: WebtoonPlatform,
    title: string,
  ): Promise<WebtoonLog | null> {
    // "화산 귀환"과 "화산귀환"을 같은 작품으로 본다
    const row = await this.logs
      .createQueryBuilder('l')
      .where('l.platform = :platform', { platform })
      .andWhere(`regexp_replace(lower(l.title), '\\s', '', 'g') = :key`, {
        key: title.replace(/\s+/g, '').toLowerCase(),
      })
      .getOne();
    return row ? toDomain(row) : null;
  }

  async save(input: WebtoonLogInput, id?: string): Promise<WebtoonLog> {
    const row = await this.logs.save(this.logs.create({ ...input, id }));
    return toDomain(row);
  }

  async appendHistory(
    logId: string,
    entry: Omit<WebtoonLogHistoryEntry, 'recordedAt'>,
  ): Promise<void> {
    await this.history.insert({ logId, ...entry });
  }

  async findHistory(logId: string): Promise<WebtoonLogHistoryEntry[]> {
    const rows = await this.history.find({
      where: { logId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => ({
      episode: r.episode,
      status: r.status,
      verdict: r.verdict,
      readAt: r.readAt,
      recordedAt: r.createdAt,
    }));
  }

  async delete(id: string): Promise<boolean> {
    return this.logs.manager.transaction(async (em) => {
      const result = await em.delete(WebtoonLogOrmEntity, { id });
      if (!result.affected) return false;
      await em.delete(WebtoonLogHistoryOrmEntity, { logId: id });
      return true;
    });
  }
}

function toDomain(r: WebtoonLogOrmEntity): WebtoonLog {
  return {
    id: r.id,
    title: r.title,
    platform: r.platform,
    naverTitleId: r.naverTitleId,
    episode: r.episode,
    status: r.status,
    verdict: r.verdict,
    memo: r.memo,
    url: r.url,
    lastReadAt: r.lastReadAt,
    updatedAt: r.updatedAt,
  };
}
