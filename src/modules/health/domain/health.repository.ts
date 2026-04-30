import { HealthProfile } from './health.entity.js';

export const HEALTH_REPOSITORY = Symbol('HEALTH_REPOSITORY');

export interface HealthRepository {
  findLatestByUserId(userId: string): Promise<HealthProfile | null>;
  upsert(userId: string, data: Record<string, unknown>): Promise<HealthProfile>;
}
