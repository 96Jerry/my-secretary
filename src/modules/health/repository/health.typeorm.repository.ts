import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HealthProfile } from '../domain/health.entity';
import { HealthRepository } from '../domain/health.repository';
import { HealthOrmEntity } from './health.orm-entity';

@Injectable()
export class HealthTypeormRepository implements HealthRepository {
  constructor(
    @InjectRepository(HealthOrmEntity)
    private readonly repo: Repository<HealthOrmEntity>,
  ) {}

  async findLatestByUserId(userId: string): Promise<HealthProfile | null> {
    const row = await this.repo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<HealthProfile> {
    const existing = await this.repo.findOne({ where: { userId } });
    const saved = await this.repo.save({ ...(existing ?? {}), userId, data });
    return this.toDomain(saved);
  }

  private toDomain(row: HealthOrmEntity): HealthProfile {
    return new HealthProfile(row.id, row.userId, row.data, row.updatedAt);
  }
}
