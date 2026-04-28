import { Inject, Injectable } from '@nestjs/common';

import { ScheduleEntry } from '../domain/schedule.entity';
import {
  SCHEDULE_REPOSITORY,
  type ScheduleRepository,
} from '../domain/schedule.repository';

@Injectable()
export class ScheduleService {
  constructor(
    @Inject(SCHEDULE_REPOSITORY)
    private readonly scheduleRepository: ScheduleRepository,
  ) {}

  getForDate(userId: string, date: string): Promise<ScheduleEntry | null> {
    return this.scheduleRepository.findByUserAndDate(userId, date);
  }

  upsert(
    userId: string,
    date: string,
    data: Record<string, unknown>,
  ): Promise<ScheduleEntry> {
    return this.scheduleRepository.upsert(userId, date, data);
  }
}
