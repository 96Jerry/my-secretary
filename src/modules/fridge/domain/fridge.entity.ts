export class FridgeSnapshot {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: Record<string, unknown>,
    public readonly updatedAt: Date,
  ) {}
}
