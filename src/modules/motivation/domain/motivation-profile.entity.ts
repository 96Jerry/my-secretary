export class MotivationProfile {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly goal: string | null,
    public readonly situation: string | null,
    public readonly rewrittenGoal: string | null,
    public readonly rewrittenSituation: string | null,
    public readonly goalHash: string | null,
    public readonly situationHash: string | null,
    public readonly daysNotStudied: number,
    public readonly lastStudiedAt: Date | null,
    public readonly enabled: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  // 22:00 알림 기능을 위한 placeholder. 본 작업에서는 호출자 없음.
  incrementDaysNotStudied(): MotivationProfile {
    return new MotivationProfile(
      this.id,
      this.userId,
      this.goal,
      this.situation,
      this.rewrittenGoal,
      this.rewrittenSituation,
      this.goalHash,
      this.situationHash,
      this.daysNotStudied + 1,
      this.lastStudiedAt,
      this.enabled,
      this.createdAt,
      this.updatedAt,
    );
  }

  // 22:00 알림 기능을 위한 placeholder. 본 작업에서는 호출자 없음.
  markStudied(at: Date): MotivationProfile {
    return new MotivationProfile(
      this.id,
      this.userId,
      this.goal,
      this.situation,
      this.rewrittenGoal,
      this.rewrittenSituation,
      this.goalHash,
      this.situationHash,
      0,
      at,
      this.enabled,
      this.createdAt,
      this.updatedAt,
    );
  }
}
