import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PalworldNewsRepository } from '../domain/palworld-news.repository.js';
import { PalworldNewsOrmEntity } from './palworld-news.orm-entity.js';

@Injectable()
export class PalworldNewsTypeormRepository implements PalworldNewsRepository {
  constructor(
    @InjectRepository(PalworldNewsOrmEntity)
    private readonly repo: Repository<PalworldNewsOrmEntity>,
  ) {}

  async isEmpty(): Promise<boolean> {
    const count = await this.repo.count();
    return count === 0;
  }

  async findKnownGids(gids: string[]): Promise<Set<string>> {
    if (gids.length === 0) return new Set();
    const rows = await this.repo.find({ where: { gid: In(gids) } });
    return new Set(rows.map((row) => row.gid));
  }

  async saveGids(gids: string[]): Promise<void> {
    if (gids.length === 0) return;
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(PalworldNewsOrmEntity)
      .values(gids.map((gid) => ({ gid })))
      .orIgnore()
      .execute();
  }
}
