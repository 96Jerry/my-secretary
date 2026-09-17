import { FridgeUnit } from './fridge-item.entity.js';

/**
 * 냉장고 변경 한 건. 파서가 메시지에서 뽑아내고 저장소가 그대로 적용한다.
 * - set: 새로 넣거나 기존 수량을 덮어씀
 * - adjust: 기존 수량에 더함 (차감은 음수). 결과가 0 이하면 행 삭제
 * - remove: 다 써서 삭제
 */
export type FridgeChange =
  | {
      op: 'set';
      name: string;
      quantity: number;
      unit: FridgeUnit;
      expiresAt: string | null;
    }
  | { op: 'adjust'; name: string; quantity: number }
  | { op: 'remove'; name: string };
