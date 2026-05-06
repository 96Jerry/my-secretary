import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SituationController } from './controller/situation.controller.js';
import { SITUATION_REPOSITORY } from './domain/situation.repository.js';
import { SituationOrmEntity } from './repository/situation.orm-entity.js';
import { SituationTypeormRepository } from './repository/situation.typeorm.repository.js';
import { SituationService } from './service/situation.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SituationOrmEntity])],
  controllers: [SituationController],
  providers: [
    SituationService,
    { provide: SITUATION_REPOSITORY, useClass: SituationTypeormRepository },
  ],
  exports: [SituationService],
})
export class SituationModule {}
