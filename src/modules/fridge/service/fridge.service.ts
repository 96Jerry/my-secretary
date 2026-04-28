import { Inject, Injectable } from '@nestjs/common';

import { FridgeSnapshot } from '../domain/fridge.entity';
import {
  FRIDGE_REPOSITORY,
  type FridgeRepository,
} from '../domain/fridge.repository';

@Injectable()
export class FridgeService {
  constructor(
    @Inject(FRIDGE_REPOSITORY)
    private readonly fridgeRepository: FridgeRepository,
  ) {}

  getLatest(userId: string): Promise<FridgeSnapshot | null> {
    return this.fridgeRepository.findLatestByUserId(userId);
  }

  upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<FridgeSnapshot> {
    return this.fridgeRepository.upsert(userId, data);
  }
}
