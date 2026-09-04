import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 이미 알림을 보낸 IMAX 상영회차. '상영일:상영관번호:시작시각:영화번호'를 자연키로 쓴다.
 *
 * CGV가 주는 scnSseq(당일 회차 순번)는 앞 시간대에 회차가 하나 추가되면 뒤 번호가
 * 전부 밀려 기존 회차까지 신규로 오탐되므로 키에 넣지 않는다.
 * 잔여 좌석수도 계속 변하므로 마찬가지.
 */
@Entity('cgv_imax_showtime')
export class CgvImaxShowtimeOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  showtimeKey!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
