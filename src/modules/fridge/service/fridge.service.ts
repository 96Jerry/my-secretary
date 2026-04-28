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
    // return this.fridgeRepository.findLatestByUserId(userId);
    return Promise.resolve(defaultFridge(userId));
  }

  upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<FridgeSnapshot> {
    // return this.fridgeRepository.upsert(userId, data);
    return Promise.resolve(
      new FridgeSnapshot(STUB_ID, userId, data, new Date()),
    );
  }
}

const STUB_ID = '00000000-0000-0000-0000-000000000010';

function defaultFridge(userId: string): FridgeSnapshot {
  return new FridgeSnapshot(
    STUB_ID,
    userId,
    {
      items: [
        { name: '닭가슴살', quantity: '800g' },
        { name: '계란', quantity: 10 },
        { name: '3분 카레', quantity: 10 },
        { name: '햇반', quantity: 10 },
      ],
    },
    new Date(),
  );
}
