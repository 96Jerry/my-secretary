import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FridgeChange } from '../domain/fridge-change.js';
import { FridgeItem } from '../domain/fridge-item.entity.js';
import { FridgeRepository } from '../domain/fridge.repository.js';
import { FridgeItemOrmEntity } from './fridge-item.orm-entity.js';

@Injectable()
export class FridgeTypeormRepository implements FridgeRepository {
  constructor(
    @InjectRepository(FridgeItemOrmEntity)
    private readonly repo: Repository<FridgeItemOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<FridgeItem[]> {
    const rows = await this.repo.find({
      where: { userId },
      // 유통기한 없는 항목(null)은 뒤로.
      order: { expiresAt: { direction: 'ASC', nulls: 'LAST' }, name: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async applyChanges(
    userId: string,
    changes: FridgeChange[],
  ): Promise<FridgeItem[]> {
    for (const change of changes) {
      const existing = await this.repo.findOne({
        where: { userId, name: change.name },
      });

      if (change.op === 'remove') {
        if (existing) await this.repo.remove(existing);
        continue;
      }

      if (change.op === 'set') {
        await this.repo.save({
          ...(existing ?? {}),
          userId,
          name: change.name,
          quantity: change.quantity,
          unit: change.unit,
          expiresAt: change.expiresAt ?? existing?.expiresAt ?? null,
        });
        continue;
      }

      // adjust: 없는 아이템은 차감할 게 없으므로 무시.
      if (!existing) continue;
      const quantity = existing.quantity + change.quantity;
      if (quantity <= 0) {
        await this.repo.remove(existing);
        continue;
      }
      await this.repo.save({ ...existing, quantity });
    }

    return this.findByUserId(userId);
  }

  private toDomain(row: FridgeItemOrmEntity): FridgeItem {
    return new FridgeItem(
      row.id,
      row.userId,
      row.name,
      row.quantity,
      row.unit,
      row.expiresAt,
      row.updatedAt,
    );
  }
}
