import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebtoonRankingEntry } from '../domain/webtoon-ranking-entry.entity.js';
import { WebtoonRankingRepository } from '../domain/webtoon-ranking.repository.js';
import { WebtoonRankingSnapshotOrmEntity } from './webtoon-ranking-snapshot.orm-entity.js';

@Injectable()
export class WebtoonRankingTypeormRepository implements WebtoonRankingRepository {
  constructor(
    @InjectRepository(WebtoonRankingSnapshotOrmEntity)
    private readonly repo: Repository<WebtoonRankingSnapshotOrmEntity>,
  ) {}

  async saveSnapshot(
    date: string,
    entries: WebtoonRankingEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(WebtoonRankingSnapshotOrmEntity)
      .values(entries.map((e) => ({ snapshotDate: date, ...e })))
      .orUpdate(
        ['titleName', 'favoriteCount', 'genreCode', 'genreName'],
        ['snapshotDate', 'titleId'],
      )
      .execute();
  }

  async findLatestDate(): Promise<string | null> {
    // raw MAX()는 pg 드라이버가 date를 로컬 자정 Date로 바꿔 하루가 밀릴 수 있다.
    // 엔티티로 읽으면 TypeORM이 'YYYY-MM-DD' 문자열로 돌려준다.
    const [row] = await this.repo.find({
      select: { snapshotDate: true },
      order: { snapshotDate: 'DESC' },
      take: 1,
    });
    return row?.snapshotDate ?? null;
  }

  async findByDate(date: string): Promise<WebtoonRankingEntry[]> {
    const rows = await this.repo.find({
      where: { snapshotDate: date },
      order: { favoriteCount: 'DESC', titleId: 'ASC' },
    });
    return rows.map(
      (r) =>
        new WebtoonRankingEntry(
          r.titleId,
          r.titleName,
          r.favoriteCount,
          r.genreCode,
          r.genreName,
        ),
    );
  }
}
