export class ScheduleEntry {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly date: string,
    public readonly data: Record<string, unknown>,
    public readonly updatedAt: Date,
  ) {}
}
