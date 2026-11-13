import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { ReadStatus, Verdict } from '../domain/webtoon-log.entity.js';

@Entity('webtoon_log_history')
export class WebtoonLogHistoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  logId!: string;

  @Column({ type: 'int', nullable: true })
  episode!: number | null;

  @Column({ type: 'varchar', length: 16 })
  status!: ReadStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  verdict!: Verdict | null;

  @Column({ type: 'date', nullable: true })
  readAt!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
