import { ActivityType, type Presence } from 'discord.js';

import type { PlayingActivity } from '@modules/game-log/domain/game-session.entity.js';

// 디스코드 상태 중 "게임 하는 중"만 뽑는다. 음악·방송·사용자 지정 상태는 뺀다
export function playingActivities(
  presence: Pick<Presence, 'activities'> | null | undefined,
): PlayingActivity[] {
  return (presence?.activities ?? [])
    .filter((a) => a.type === ActivityType.Playing)
    .map((a) => ({
      name: a.name,
      applicationId: a.applicationId ?? null,
      startedAt: a.timestamps?.start ?? null,
    }));
}
