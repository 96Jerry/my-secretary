import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CgvImaxRepository } from '../domain/cgv-imax.repository.js';
import { CgvImaxShowtimeOrmEntity } from './cgv-imax-showtime.orm-entity.js';

@Injectable()
export class CgvImaxTypeormRepository implements CgvImaxRepository {
  constructor(
    @InjectRepository(CgvImaxShowtimeOrmEntity)
    private readonly repo: Repository<CgvImaxShowtimeOrmEntity>,
  ) {}

  async findAllKeys(): Promise<Set<string>> {
    const rows = await this.repo.find({ select: { showtimeKey: true } });
    return new Set(rows.map((row) => row.showtimeKey));
  }

  async saveKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(CgvImaxShowtimeOrmEntity)
      .values(keys.map((showtimeKey) => ({ showtimeKey })))
      .orIgnore()
      .execute();
  }
}
