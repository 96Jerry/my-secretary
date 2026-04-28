import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduleController } from './controller/schedule.controller';
import { SCHEDULE_REPOSITORY } from './domain/schedule.repository';
import { ScheduleOrmEntity } from './repository/schedule.orm-entity';
import { ScheduleTypeormRepository } from './repository/schedule.typeorm.repository';
import { ScheduleService } from './service/schedule.service';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleOrmEntity])],
  controllers: [ScheduleController],
  providers: [
    ScheduleService,
    { provide: SCHEDULE_REPOSITORY, useClass: ScheduleTypeormRepository },
  ],
  exports: [ScheduleService],
})
export class ScheduleDomainModule {}
