import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('motivation_messages')
@Unique(['userId', 'sentDate'])
export class MotivationMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  userId!: string;

  // 발송 기준일 (Asia/Seoul). (userId, sentDate) UNIQUE 로 같은 날 중복 발송 차단.
  @Column({ type: 'date' })
  sentDate!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int' })
  daysNotStudiedAtSend!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
