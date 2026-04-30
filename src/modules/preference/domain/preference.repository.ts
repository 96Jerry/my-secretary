import { Preference } from './preference.entity.js';

export const PREFERENCE_REPOSITORY = Symbol('PREFERENCE_REPOSITORY');

export interface PreferenceRepository {
  findLatestByUserId(userId: string): Promise<Preference | null>;
  upsert(userId: string, data: Record<string, unknown>): Promise<Preference>;
}
