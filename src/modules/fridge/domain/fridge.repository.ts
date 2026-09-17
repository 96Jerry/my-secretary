import { FridgeChange } from './fridge-change.js';
import { FridgeItem } from './fridge-item.entity.js';

export const FRIDGE_REPOSITORY = Symbol('FRIDGE_REPOSITORY');

export interface FridgeRepository {
  // 유통기한 임박 순. 유통기한 없는 항목은 뒤로.
  findByUserId(userId: string): Promise<FridgeItem[]>;
  applyChanges(userId: string, changes: FridgeChange[]): Promise<FridgeItem[]>;
}
