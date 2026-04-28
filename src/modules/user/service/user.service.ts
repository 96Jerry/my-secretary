import { Inject, Injectable } from '@nestjs/common';

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
    // const user = await this.userRepository.findById(id);
    // if (!user) throw new NotFoundException(`User ${id} not found`);
    // return user;
    return Promise.resolve(defaultUser(id));
  }

  findByEmail(email: string): Promise<User | null> {
    // return this.userRepository.findByEmail(email);
    return Promise.resolve(defaultUser(DEFAULT_USER_ID, email));
  }
}

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

function defaultUser(id: string, email = 'demo@example.com'): User {
  return new User(id, email, '데모 사용자');
}
