import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Situation } from '../domain/situation.entity.js';
import { SituationRepository } from '../domain/situation.repository.js';
import { SituationOrmEntity } from './situation.orm-entity.js';

@Injectable()
export class SituationTypeormRepository implements SituationRepository {
  constructor(
    @InjectRepository(SituationOrmEntity)
    private readonly repo: Repository<SituationOrmEntity>,
  ) {}

  async findLatestByUserId(userId: string): Promise<Situation | null> {
    const row = await this.repo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<Situation> {
    const existing = await this.repo.findOne({ where: { userId } });
    const saved = await this.repo.save({ ...(existing ?? {}), userId, data });
    return this.toDomain(saved);
  }

  private toDomain(row: SituationOrmEntity): Situation {
    return new Situation(row.id, row.userId, row.data, row.updatedAt);
  }
}
