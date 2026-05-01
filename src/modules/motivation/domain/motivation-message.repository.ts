import { MotivationMessage } from './motivation-message.entity.js';

export const MOTIVATION_MESSAGE_REPOSITORY = Symbol(
  'MOTIVATION_MESSAGE_REPOSITORY',
);

export interface MotivationMessageRepository {
  findLatestByUserId(userId: string): Promise<MotivationMessage | null>;
  existsForDate(userId: string, sentDate: string): Promise<boolean>;
  save(input: {
    userId: string;
    sentDate: string;
    content: string;
    daysNotStudiedAtSend: number;
  }): Promise<MotivationMessage>;
}
