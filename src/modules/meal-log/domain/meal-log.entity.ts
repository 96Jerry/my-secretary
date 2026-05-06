export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export class MealLog {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly date: string,
    public readonly slot: MealSlot,
    public readonly data: Record<string, unknown>,
    public readonly updatedAt: Date,
  ) {}
}
