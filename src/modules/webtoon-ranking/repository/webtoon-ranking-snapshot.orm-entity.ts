import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 하루 한 장씩 쌓이는 찜 수 스냅샷. 날짜별로 남겨 두면 나중에 증감 추이를 볼 수 있다.
 * 같은 날 수동 수집을 다시 하면 (날짜, 작품) 키로 덮어쓴다.
 */
@Entity('webtoon_ranking_snapshot')
export class WebtoonRankingSnapshotOrmEntity {
  @PrimaryColumn({ type: 'date' })
  snapshotDate!: string;

  @PrimaryColumn({ type: 'int' })
  titleId!: number;

  @Column({ type: 'varchar', length: 200 })
  titleName!: string;

  @Column({ type: 'int' })
  favoriteCount!: number;

  @Column({ type: 'varchar', length: 32 })
  genreCode!: string;

  @Column({ type: 'varchar', length: 32 })
  genreName!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
