import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CgvImaxRepository } from '../domain/cgv-imax.repository.js';
import { CgvImaxOpenedDateOrmEntity } from './cgv-imax-opened-date.orm-entity.js';
import { CgvImaxShowtimeOrmEntity } from './cgv-imax-showtime.orm-entity.js';

@Injectable()
export class CgvImaxTypeormRepository implements CgvImaxRepository {
  constructor(
    @InjectRepository(CgvImaxShowtimeOrmEntity)
    private readonly repo: Repository<CgvImaxShowtimeOrmEntity>,
    @InjectRepository(CgvImaxOpenedDateOrmEntity)
    private readonly openedDateRepo: Repository<CgvImaxOpenedDateOrmEntity>,
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

  async findOpenedDates(): Promise<Set<string>> {
    const rows = await this.openedDateRepo.find({ select: { scnYmd: true } });
    return new Set(rows.map((row) => row.scnYmd));
  }

  async saveOpenedDates(dates: string[]): Promise<void> {
    if (dates.length === 0) return;
    await this.openedDateRepo
      .createQueryBuilder()
      .insert()
      .into(CgvImaxOpenedDateOrmEntity)
      .values(dates.map((scnYmd) => ({ scnYmd })))
      .orIgnore()
      .execute();
  }
}
