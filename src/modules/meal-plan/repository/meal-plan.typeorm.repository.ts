import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MealPlan } from '../domain/meal-plan.entity';
import { MealPlanRepository } from '../domain/meal-plan.repository';
import { MealPlanOrmEntity } from './meal-plan.orm-entity';

@Injectable()
export class MealPlanTypeormRepository implements MealPlanRepository {
  constructor(
    @InjectRepository(MealPlanOrmEntity)
    private readonly repo: Repository<MealPlanOrmEntity>,
  ) {}

  async findByUserAndDate(
    userId: string,
    date: string,
  ): Promise<MealPlan | null> {
    const row = await this.repo.findOne({ where: { userId, date } });
    return row ? this.toDomain(row) : null;
  }

  async save(userId: string, date: string, content: string): Promise<MealPlan> {
    const existing = await this.repo.findOne({ where: { userId, date } });
    const saved = await this.repo.save({
      ...(existing ?? {}),
      userId,
      date,
      content,
    });
    return this.toDomain(saved);
  }

  private toDomain(row: MealPlanOrmEntity): MealPlan {
    return new MealPlan(
      row.id,
      row.userId,
      row.date,
      row.content,
      row.createdAt,
    );
  }
}
