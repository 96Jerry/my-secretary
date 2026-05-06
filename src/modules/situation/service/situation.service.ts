import { Inject, Injectable } from '@nestjs/common';

import { Situation } from '../domain/situation.entity.js';
import {
  SITUATION_REPOSITORY,
  type SituationRepository,
} from '../domain/situation.repository.js';

@Injectable()
export class SituationService {
  constructor(
    @Inject(SITUATION_REPOSITORY)
    private readonly situationRepository: SituationRepository,
  ) {}

  getLatest(userId: string): Promise<Situation | null> {
    return this.situationRepository.findLatestByUserId(userId);
  }

  upsert(userId: string, data: Record<string, unknown>): Promise<Situation> {
    return this.situationRepository.upsert(userId, data);
  }
}
