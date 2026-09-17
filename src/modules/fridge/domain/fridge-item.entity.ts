// 수량 단위. 파서가 이 셋 중 하나로 변환해 넣는다 (1L → 1000 ml).
export type FridgeUnit = 'g' | 'ml' | '개';

export class FridgeItem {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly quantity: number,
    public readonly unit: FridgeUnit,
    // 유통기한. 모르면 null.
    public readonly expiresAt: string | null,
    public readonly updatedAt: Date,
  ) {}
}
