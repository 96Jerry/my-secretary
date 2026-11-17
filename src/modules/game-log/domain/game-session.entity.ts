// 게임을 한 번 켰다 끈 구간 하나. 끝나지 않았으면 endedAt이 null이다
export interface GameSession {
  id: string;
  gameName: string;
  applicationId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  // 봇이 마지막으로 "아직 하는 중"을 확인한 시각. 봇이 꺼져 있던 동안의 종료 시각 추정에 쓴다
  lastSeenAt: Date;
}

// 디스코드 상태에서 뽑아낸 "지금 하는 게임"
export interface PlayingActivity {
  name: string;
  applicationId: string | null;
  startedAt: Date | null;
}

export type NewGameSession = Omit<GameSession, 'id' | 'endedAt'>;
