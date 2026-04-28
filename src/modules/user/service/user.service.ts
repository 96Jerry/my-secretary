import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { User } from '../domain/user.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../domain/user.repository';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findAllWithGuildId(): Promise<User[]> {
    return this.userRepository.findAllWithGuildId();
  }

  async findOrCreateByGuildId(
    guildId: string,
    name: string | null,
  ): Promise<User> {
    const existing = await this.userRepository.findByGuildId(guildId);
    if (existing) return existing;
    return this.userRepository.create({ guildId, name });
  }
}
