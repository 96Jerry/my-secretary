import { Inject, Injectable } from '@nestjs/common';

import { HealthProfile } from '../domain/health.entity.js';
import {
  HEALTH_REPOSITORY,
  type HealthRepository,
} from '../domain/health.repository.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_REPOSITORY)
    private readonly healthRepository: HealthRepository,
  ) {}

  getLatest(userId: string): Promise<HealthProfile | null> {
    return this.healthRepository.findLatestByUserId(userId);
  }

  upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<HealthProfile> {
    return this.healthRepository.upsert(userId, data);
  }
}
