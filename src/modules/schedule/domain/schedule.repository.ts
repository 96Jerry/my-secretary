import { ScheduleEntry } from './schedule.entity.js';

export const SCHEDULE_REPOSITORY = Symbol('SCHEDULE_REPOSITORY');

export interface ScheduleRepository {
  findByUserAndDate(
    userId: string,
    date: string,
  ): Promise<ScheduleEntry | null>;
  upsert(
    userId: string,
    date: string,
    data: Record<string, unknown>,
  ): Promise<ScheduleEntry>;
}
