import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('game_sessions')
export class GameSessionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  gameName!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  applicationId!: string | null;

  @Index()
  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  lastSeenAt!: Date;
}
