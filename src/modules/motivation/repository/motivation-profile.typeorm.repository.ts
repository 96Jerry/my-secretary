import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MotivationProfile } from '../domain/motivation-profile.entity.js';
import { MotivationProfileRepository } from '../domain/motivation-profile.repository.js';
import { MotivationProfileOrmEntity } from './motivation-profile.orm-entity.js';

@Injectable()
export class MotivationProfileTypeormRepository implements MotivationProfileRepository {
  constructor(
    @InjectRepository(MotivationProfileOrmEntity)
    private readonly repo: Repository<MotivationProfileOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<MotivationProfile | null> {
    const row = await this.repo.findOne({ where: { userId } });
    return row ? this.toDomain(row) : null;
  }

  async findAllEnabled(): Promise<MotivationProfile[]> {
    const rows = await this.repo.find({ where: { enabled: true } });
    return rows.map((r) => this.toDomain(r));
  }

  async updateGoalCache(
    userId: string,
    rewrittenGoal: string,
    goalHash: string,
  ): Promise<void> {
    await this.repo.update({ userId }, { rewrittenGoal, goalHash });
  }

  async updateSituationCache(
    userId: string,
    rewrittenSituation: string,
    situationHash: string,
  ): Promise<void> {
    await this.repo.update({ userId }, { rewrittenSituation, situationHash });
  }

  // 22:00 알림 기능을 위한 placeholder. 본 작업에서는 호출자 없음.
  async incrementDaysNotStudied(userId: string): Promise<void> {
    await this.repo.increment({ userId }, 'daysNotStudied', 1);
  }

  // 22:00 알림 기능을 위한 placeholder. 본 작업에서는 호출자 없음.
  async markStudied(userId: string, at: Date): Promise<void> {
    await this.repo.update(
      { userId },
      { daysNotStudied: 0, lastStudiedAt: at },
    );
  }

  private toDomain(row: MotivationProfileOrmEntity): MotivationProfile {
    return new MotivationProfile(
      row.id,
      row.userId,
      row.goal,
      row.situation,
      row.rewrittenGoal,
      row.rewrittenSituation,
      row.goalHash,
      row.situationHash,
      row.daysNotStudied,
      row.lastStudiedAt,
      row.enabled,
      row.createdAt,
      row.updatedAt,
    );
  }
}
