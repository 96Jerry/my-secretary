import { Inject, Injectable } from '@nestjs/common';

import { Preference } from '../domain/preference.entity.js';
import {
  PREFERENCE_REPOSITORY,
  type PreferenceRepository,
} from '../domain/preference.repository.js';

@Injectable()
export class PreferenceService {
  constructor(
    @Inject(PREFERENCE_REPOSITORY)
    private readonly preferenceRepository: PreferenceRepository,
  ) {}

  getLatest(userId: string): Promise<Preference | null> {
    return this.preferenceRepository.findLatestByUserId(userId);
  }

  upsert(userId: string, data: Record<string, unknown>): Promise<Preference> {
    return this.preferenceRepository.upsert(userId, data);
  }
}
