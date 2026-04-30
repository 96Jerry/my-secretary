import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PreferenceController } from './controller/preference.controller.js';
import { PREFERENCE_REPOSITORY } from './domain/preference.repository.js';
import { PreferenceOrmEntity } from './repository/preference.orm-entity.js';
import { PreferenceTypeormRepository } from './repository/preference.typeorm.repository.js';
import { PreferenceService } from './service/preference.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PreferenceOrmEntity])],
  controllers: [PreferenceController],
  providers: [
    PreferenceService,
    { provide: PREFERENCE_REPOSITORY, useClass: PreferenceTypeormRepository },
  ],
  exports: [PreferenceService],
})
export class PreferenceModule {}
