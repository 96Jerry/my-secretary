import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FridgeSnapshot } from '../domain/fridge.entity';
import { FridgeRepository } from '../domain/fridge.repository';
import { FridgeOrmEntity } from './fridge.orm-entity';

@Injectable()
export class FridgeTypeormRepository implements FridgeRepository {
  constructor(
    @InjectRepository(FridgeOrmEntity)
    private readonly repo: Repository<FridgeOrmEntity>,
  ) {}

  async findLatestByUserId(userId: string): Promise<FridgeSnapshot | null> {
    const row = await this.repo.findOne({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<FridgeSnapshot> {
    const existing = await this.repo.findOne({ where: { userId } });
    const saved = await this.repo.save({ ...(existing ?? {}), userId, data });
    return this.toDomain(saved);
  }

  private toDomain(row: FridgeOrmEntity): FridgeSnapshot {
    return new FridgeSnapshot(row.id, row.userId, row.data, row.updatedAt);
  }
}
