import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScheduleEntry } from '../domain/schedule.entity.js';
import { ScheduleRepository } from '../domain/schedule.repository.js';
import { ScheduleOrmEntity } from './schedule.orm-entity.js';

@Injectable()
export class ScheduleTypeormRepository implements ScheduleRepository {
  constructor(
    @InjectRepository(ScheduleOrmEntity)
    private readonly repo: Repository<ScheduleOrmEntity>,
  ) {}

  async findByUserAndDate(
    userId: string,
    date: string,
  ): Promise<ScheduleEntry | null> {
    const row = await this.repo.findOne({ where: { userId, date } });
    return row ? this.toDomain(row) : null;
  }

  async upsert(
    userId: string,
    date: string,
    data: Record<string, unknown>,
  ): Promise<ScheduleEntry> {
    const existing = await this.repo.findOne({ where: { userId, date } });
    const saved = await this.repo.save({
      ...(existing ?? {}),
      userId,
      date,
      data,
    });
    return this.toDomain(saved);
  }

  private toDomain(row: ScheduleOrmEntity): ScheduleEntry {
    return new ScheduleEntry(
      row.id,
      row.userId,
      row.date,
      row.data,
      row.updatedAt,
    );
  }
}
