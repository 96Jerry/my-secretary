import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { User } from '../domain/user.entity.js';
import { UserRepository } from '../domain/user.repository.js';
import { UserOrmEntity } from './user.orm-entity.js';

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

  async findByGuildId(guildId: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { guildId } });
    return row ? this.toDomain(row) : null;
  }

  async findAllWithGuildId(): Promise<User[]> {
    const rows = await this.repo.find({ where: { guildId: Not(IsNull()) } });
    return rows.map((r) => this.toDomain(r));
  }

  async create(input: { guildId: string; name: string | null }): Promise<User> {
    const saved = await this.repo.save({
      guildId: input.guildId,
      name: input.name,
    });
    return this.toDomain(saved);
  }

  private toDomain(row: UserOrmEntity): User {
    return new User(row.id, row.email, row.name, row.guildId);
  }
}
