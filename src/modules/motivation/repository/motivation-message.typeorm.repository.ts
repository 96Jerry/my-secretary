import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MotivationMessage } from '../domain/motivation-message.entity.js';
import { MotivationMessageRepository } from '../domain/motivation-message.repository.js';
import { MotivationMessageOrmEntity } from './motivation-message.orm-entity.js';

@Injectable()
export class MotivationMessageTypeormRepository implements MotivationMessageRepository {
  constructor(
    @InjectRepository(MotivationMessageOrmEntity)
    private readonly repo: Repository<MotivationMessageOrmEntity>,
  ) {}

  async findLatestByUserId(userId: string): Promise<MotivationMessage | null> {
    const row = await this.repo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async existsForDate(userId: string, sentDate: string): Promise<boolean> {
    const count = await this.repo.count({ where: { userId, sentDate } });
    return count > 0;
  }

  async save(input: {
    userId: string;
    sentDate: string;
    content: string;
    daysNotStudiedAtSend: number;
  }): Promise<MotivationMessage> {
    const saved = await this.repo.save(input);
    return this.toDomain(saved);
  }

  private toDomain(row: MotivationMessageOrmEntity): MotivationMessage {
    return new MotivationMessage(
      row.id,
      row.userId,
      row.sentDate,
      row.content,
      row.daysNotStudiedAtSend,
      row.createdAt,
    );
  }
}
