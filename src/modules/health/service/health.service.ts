import { Inject, Injectable } from '@nestjs/common';

import { HealthProfile } from '../domain/health.entity';
import {
  HEALTH_REPOSITORY,
  type HealthRepository,
} from '../domain/health.repository';

@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_REPOSITORY)
    private readonly healthRepository: HealthRepository,
  ) {}

  getLatest(userId: string): Promise<HealthProfile | null> {
    // return this.healthRepository.findLatestByUserId(userId);
    return Promise.resolve(defaultHealth(userId));
  }

  upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<HealthProfile> {
    // return this.healthRepository.upsert(userId, data);
    return Promise.resolve(
      new HealthProfile(STUB_ID, userId, data, new Date()),
    );
  }
}

const STUB_ID = '00000000-0000-0000-0000-000000000020';

function defaultHealth(userId: string): HealthProfile {
  return new HealthProfile(
    STUB_ID,
    userId,
    {
      goal: 'muscle_gain',
      age: 30,
      weightKg: 65,
      heightCm: 170,
      allergies: ['키위'],
    },
    new Date(),
  );
}
