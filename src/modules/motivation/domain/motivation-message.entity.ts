export class MotivationMessage {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly sentDate: string,
    public readonly content: string,
    public readonly daysNotStudiedAtSend: number,
    public readonly createdAt: Date,
  ) {}
}
