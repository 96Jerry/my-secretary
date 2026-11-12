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

  // 이 아래는 나중에 추가한 컬럼이라 이전 스냅샷에는 값이 없다
  @Column({ type: 'varchar', length: 200, nullable: true })
  author!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl!: string | null;

  // real은 pg 드라이버가 number로 돌려준다. numeric은 문자열이 되므로 쓰지 않는다.
  @Column({ type: 'real', nullable: true })
  starScore!: number | null;

  @Column({ type: 'boolean', nullable: true })
  isRest!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  isNew!: boolean | null;

  @CreateDateColumn()
  createdAt!: Date;
}
