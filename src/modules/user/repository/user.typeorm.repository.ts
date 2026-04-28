import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../domain/user.entity';
import { UserRepository } from '../domain/user.repository';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class UserTypeormRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<User> {
    const saved = await this.repo.save({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    return this.toDomain(saved);
  }

  private toDomain(row: UserOrmEntity): User {
    return new User(row.id, row.email, row.name);
  }
}
