import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { MealLog, MealSlot } from '../domain/meal-log.entity.js';
import { MealLogRepository } from '../domain/meal-log.repository.js';
import { MealLogOrmEntity } from './meal-log.orm-entity.js';

@Injectable()
export class MealLogTypeormRepository implements MealLogRepository {
  constructor(
    @InjectRepository(MealLogOrmEntity)
    private readonly repo: Repository<MealLogOrmEntity>,
  ) {}

  async findByUserAndDate(userId: string, date: string): Promise<MealLog[]> {
    const rows = await this.repo.find({
      where: { userId, date },
      order: { slot: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async upsert(
    userId: string,
    date: string,
    slot: MealSlot,
    data: Record<string, unknown>,
  ): Promise<MealLog> {
    const existing = await this.repo.findOne({
      where: { userId, date, slot },
    });
    const saved = await this.repo.save({
      ...(existing ?? {}),
      userId,
      date,
      slot,
      data,
    });
    return this.toDomain(saved);
  }

  async findRecentByUser(
    userId: string,
    beforeDate: string,
    days: number,
  ): Promise<MealLog[]> {
    // [from, beforeDate) 범위. Between은 양 끝 포함이므로 상한은 -1일.
    const from = shiftDate(beforeDate, -days);
    const to = shiftDate(beforeDate, -1);
    const rows = await this.repo.find({
      where: { userId, date: Between(from, to) },
      order: { date: 'DESC', slot: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: MealLogOrmEntity): MealLog {
    return new MealLog(
      row.id,
      row.userId,
      row.date,
      row.slot,
      row.data,
      row.updatedAt,
    );
  }
}

// 'YYYY-MM-DD' 문자열 산술. UTC 기준으로 처리해 타임존 영향 제거.
function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
