import { User } from './user.entity.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGuildId(guildId: string): Promise<User | null>;
  findAllWithGuildId(): Promise<User[]>;
  create(input: { guildId: string; name: string | null }): Promise<User>;
}
