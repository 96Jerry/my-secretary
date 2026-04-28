import { FridgeSnapshot } from './fridge.entity';

export const FRIDGE_REPOSITORY = Symbol('FRIDGE_REPOSITORY');

export interface FridgeRepository {
  findLatestByUserId(userId: string): Promise<FridgeSnapshot | null>;
  upsert(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<FridgeSnapshot>;
}
