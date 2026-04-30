import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduleController } from './controller/schedule.controller.js';
import { SCHEDULE_REPOSITORY } from './domain/schedule.repository.js';
import { ScheduleOrmEntity } from './repository/schedule.orm-entity.js';
import { ScheduleTypeormRepository } from './repository/schedule.typeorm.repository.js';
import { ScheduleService } from './service/schedule.service.js';

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
