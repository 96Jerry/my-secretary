import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('motivation_profiles')
export class MotivationProfileOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  goal!: string | null;

  @Column({ type: 'text', nullable: true })
  situation!: string | null;

  @Column({ type: 'text', nullable: true })
  rewrittenGoal!: string | null;

  @Column({ type: 'text', nullable: true })
  rewrittenSituation!: string | null;

  // SHA-256 hex (64자). rewrittenGoal 생성 당시의 goal 해시.
  @Column({ type: 'varchar', length: 64, nullable: true })
  goalHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  situationHash!: string | null;

  @Column({ type: 'int', default: 0 })
  daysNotStudied!: number;

  // 22:00 알림 기능 placeholder. 본 작업에서 컬럼만 만들어 둠.
  @Column({ type: 'timestamp', nullable: true })
  lastStudiedAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
