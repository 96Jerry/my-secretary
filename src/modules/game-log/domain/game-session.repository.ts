import type { GameSession, NewGameSession } from './game-session.entity.js';

export const GAME_SESSION_REPOSITORY = Symbol('GAME_SESSION_REPOSITORY');

export interface GameSessionRepository {
  findOpen(): Promise<GameSession[]>;
  /** [from, to)와 겹치는 세션. from이 null이면 처음부터 */
  findOverlapping(from: Date | null, to: Date): Promise<GameSession[]>;
  open(session: NewGameSession): Promise<GameSession>;
  /** 같은 게임의 가장 최근에 끝난 세션 */
  findLastClosed(gameName: string): Promise<GameSession | null>;
  close(id: string, endedAt: Date): Promise<void>;
  reopen(id: string, at: Date): Promise<void>;
  touch(ids: string[], at: Date): Promise<void>;
  delete(id: string): Promise<boolean>;
}
