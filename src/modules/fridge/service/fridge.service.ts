import { Inject, Injectable } from '@nestjs/common';

import { FridgeChange } from '../domain/fridge-change.js';
import { FridgeItem } from '../domain/fridge-item.entity.js';
import {
  FRIDGE_REPOSITORY,
  type FridgeRepository,
} from '../domain/fridge.repository.js';

@Injectable()
export class FridgeService {
  constructor(
    @Inject(FRIDGE_REPOSITORY)
    private readonly fridgeRepository: FridgeRepository,
  ) {}

  getItems(userId: string): Promise<FridgeItem[]> {
    return this.fridgeRepository.findByUserId(userId);
  }

  applyChanges(userId: string, changes: FridgeChange[]): Promise<FridgeItem[]> {
    return this.fridgeRepository.applyChanges(userId, changes);
  }
}
