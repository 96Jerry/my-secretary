import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// 이미 알림을 보낸 팰월드 패치노트 gid. gid 자체가 자연키이므로 별도 PK를 두지 않는다.
// 사용자별 데이터가 아닌 전역 상태이므로 userId 컬럼도 없다.
@Entity('palworld_news')
export class PalworldNewsOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  gid!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
