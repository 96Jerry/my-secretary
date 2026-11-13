import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type {
  ReadStatus,
  Verdict,
  WebtoonPlatform,
} from '../domain/webtoon-log.entity.js';

@Entity('webtoon_logs')
@Unique(['platform', 'title'])
export class WebtoonLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 20 })
  platform!: WebtoonPlatform;

  @Column({ type: 'int', nullable: true })
  naverTitleId!: number | null;

  @Column({ type: 'int', nullable: true })
  episode!: number | null;

  @Column({ type: 'varchar', length: 16 })
  status!: ReadStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  verdict!: Verdict | null;

  @Column({ type: 'text', nullable: true })
  memo!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url!: string | null;

  @Column({ type: 'date', nullable: true })
  lastReadAt!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
