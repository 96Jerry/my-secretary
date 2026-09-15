import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 초기 동기화를 끝낸 감시 영화.
 *
 * 회차 키 테이블이 비었다는 사실만으로는 초기 동기화 여부를 알 수 없다.
 * 아직 예매가 열리지 않은 영화(개봉 예정작)는 감시 내내 회차가 0건이라,
 * 키 개수로 판단하면 영원히 동기화 중으로 남아 정작 예매 오픈을 알리지 못한다.
 *
 * 감시 목록에 영화를 새로 추가했을 때 기존 회차가 전부 신규로 발송되는 것도
 * 이 플래그로 막는다. 그래서 전역이 아니라 영화 단위로 둔다.
 */
@Entity('cgv_imax_movie_state')
export class CgvImaxMovieStateOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  movNo!: string;

  @CreateDateColumn()
  bootstrappedAt!: Date;
}
