import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Preference } from '../domain/preference.entity';
import { PreferenceRepository } from '../domain/preference.repository';
import { PreferenceOrmEntity } from './preference.orm-entity';

@Injectable()
export class PreferenceTypeormRepository implements PreferenceRepository {
  constructor(
    @InjectRepository(PreferenceOrmEntity)
    private readonly repo: Repository<PreferenceOrmEntity>,
  ) {}

  async findLatestByUserId(userId: string): Promise<Preference | null> {
    const row = await this.repo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<Preference> {
    const existing = await this.repo.findOne({ where: { userId } });
    const saved = await this.repo.save({ ...(existing ?? {}), userId, data });
    return this.toDomain(saved);
  }

  private toDomain(row: PreferenceOrmEntity): Preference {
    return new Preference(row.id, row.userId, row.data, row.updatedAt);
  }
}
