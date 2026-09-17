import type { FridgeChange } from '@modules/fridge/domain/fridge-change.js';
import type {
  FridgeItem,
  FridgeUnit,
} from '@modules/fridge/domain/fridge-item.entity.js';

interface Stock {
  quantity: number;
  unit: FridgeUnit;
  expiresAt: string | null;
}

/**
 * 실행 전 확인용 냉장고 변경 내역. 저장소 applyChanges와 같은 규칙으로 결과를 미리 계산한다.
 * 대상이 없어 저장소가 무시할 adjust·remove는 changes에서 빼고 안내 줄만 남긴다.
 */
export function previewFridgeChanges(
  items: FridgeItem[],
  changes: FridgeChange[],
): { changes: FridgeChange[]; lines: string[] } {
  const stock = new Map<string, Stock>(
    items.map((i) => [
      i.name,
      { quantity: i.quantity, unit: i.unit, expiresAt: i.expiresAt },
    ]),
  );
  const applied: FridgeChange[] = [];
  const lines: string[] = [];

  for (const change of changes) {
    const before = stock.get(change.name);

    if (change.op === 'set') {
      const after: Stock = {
        quantity: change.quantity,
        unit: change.unit,
        expiresAt: change.expiresAt ?? before?.expiresAt ?? null,
      };
      stock.set(change.name, after);
      applied.push(change);
      lines.push(
        before
          ? `${change.name}: ${formatStock(before)} → ${formatStock(after)}`
          : `${change.name}: 새로 추가 ${formatStock(after)}`,
      );
      continue;
    }

    if (!before) {
      lines.push(`${change.name}: 냉장고에 없어 무시`);
      continue;
    }
    applied.push(change);

    const quantity =
      change.op === 'remove' ? 0 : before.quantity + change.quantity;
    if (quantity <= 0) {
      stock.delete(change.name);
      lines.push(`${change.name}: ${formatStock(before)} → 삭제`);
      continue;
    }
    const after = { ...before, quantity };
    stock.set(change.name, after);
    lines.push(
      `${change.name}: ${formatStock(before)} → ${formatStock(after)}`,
    );
  }

  return { changes: applied, lines };
}

/**
 * 전체 최종 상태로 덮어쓰는 도메인(건강·선호·일정 등)의 필드 단위 변경 내역.
 * 바뀌지 않은 필드는 생략한다.
 */
export function previewDataChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): string[] {
  const prev = before ?? {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(after)]);
  const lines: string[] = [];

  for (const key of keys) {
    const inPrev = key in prev;
    const inAfter = key in after;
    if (!inPrev) {
      lines.push(`${key}: 새로 추가 ${formatValue(after[key])}`);
    } else if (!inAfter) {
      lines.push(`${key}: ${formatValue(prev[key])} → 삭제`);
    } else if (JSON.stringify(prev[key]) !== JSON.stringify(after[key])) {
      lines.push(
        `${key}: ${formatValue(prev[key])} → ${formatValue(after[key])}`,
      );
    }
  }

  return lines;
}

function formatStock(s: Stock): string {
  const amount = `${s.quantity}${s.unit}`;
  return s.expiresAt ? `${amount} (${s.expiresAt}까지)` : amount;
}

function formatValue(v: unknown): string {
  if (v === null) return '없음';
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.every((x) => typeof x !== 'object' || x === null)) {
    return v.length === 0 ? '없음' : v.join(', ');
  }
  return JSON.stringify(v);
}
