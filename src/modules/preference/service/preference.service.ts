import { Inject, Injectable } from '@nestjs/common';

import { Preference } from '../domain/preference.entity';
import {
  PREFERENCE_REPOSITORY,
  type PreferenceRepository,
} from '../domain/preference.repository';

@Injectable()
export class PreferenceService {
  constructor(
    @Inject(PREFERENCE_REPOSITORY)
    private readonly preferenceRepository: PreferenceRepository,
  ) {}

  getLatest(userId: string): Promise<Preference | null> {
    // return this.preferenceRepository.findLatestByUserId(userId);
    return Promise.resolve(defaultPreference(userId));
  }

  upsert(userId: string, data: Record<string, unknown>): Promise<Preference> {
    // return this.preferenceRepository.upsert(userId, data);
    return Promise.resolve(new Preference(STUB_ID, userId, data, new Date()));
  }
}

const STUB_ID = '00000000-0000-0000-0000-000000000030';

function defaultPreference(userId: string): Preference {
  return new Preference(
    STUB_ID,
    userId,
    {
      allowAdditionalShopping: true,
      modes: ['cook', 'delivery', 'eatOut'],
      foods: ['한식', '일식', '간단한 볶음/구이'],
      delivery: ['교촌 허니콤보', '서브웨이'],
    },
    new Date(),
  );
}
