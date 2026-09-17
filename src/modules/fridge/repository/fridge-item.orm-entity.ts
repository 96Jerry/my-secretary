import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type { FridgeUnit } from '../domain/fridge-item.entity.js';

// 같은 사용자가 같은 이름의 아이템을 두 행으로 갖지 않도록 (userId, name) 유니크.
@Entity('fridge_items')
@Unique(['userId', 'name'])
export class FridgeItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  userId!: string;

  @Column('text')
  name!: string;

  // numeric은 드라이버가 문자열로 돌려주므로 transformer로 number 고정.
  @Column('numeric', {
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? 0 : Number(v)),
    },
  })
  quantity!: number;

  @Column('text')
  unit!: FridgeUnit;

  @Column('date', { nullable: true })
  expiresAt!: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
