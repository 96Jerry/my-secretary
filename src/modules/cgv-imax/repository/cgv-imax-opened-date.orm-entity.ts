import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * 회차가 열린 것을 확인한 상영일자(YYYYMMDD).
 *
 * 메모리에만 두면 재기동할 때마다 열린 날짜를 앞에서부터 하나씩 다시 조회해야 하고,
 * 프런티어에 되돌아오기까지 몇 시간 동안 예매 오픈을 놓친다.
 * 날짜가 새로 열리는 건 하루 몇 건뿐이라 쓰기는 드물게 일어난다.
 */
@Entity('cgv_imax_opened_date')
export class CgvImaxOpenedDateOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  scnYmd!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
