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
    // return this.scheduleRepository.findByUserAndDate(userId, date);
    return Promise.resolve(defaultSchedule(userId, date));
  }

  upsert(
    userId: string,
    date: string,
    data: Record<string, unknown>,
  ): Promise<ScheduleEntry> {
    // return this.scheduleRepository.upsert(userId, date, data);
    return Promise.resolve(
      new ScheduleEntry(STUB_ID, userId, date, data, new Date()),
    );
  }
}

const STUB_ID = '00000000-0000-0000-0000-000000000040';

function defaultSchedule(userId: string, date: string): ScheduleEntry {
  return new ScheduleEntry(
    STUB_ID,
    userId,
    date,
    {
      sleep: { bedtime: '23:30', wakeup: '07:00' },
      appointments: [],
      workout: { type: '홈트레이닝', startTime: '21:00', durationMin: 50 },
    },
    new Date(),
  );
}
