import { Situation } from './situation.entity.js';

export const SITUATION_REPOSITORY = Symbol('SITUATION_REPOSITORY');

export interface SituationRepository {
  findLatestByUserId(userId: string): Promise<Situation | null>;
  upsert(userId: string, data: Record<string, unknown>): Promise<Situation>;
}
