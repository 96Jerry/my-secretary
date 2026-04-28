import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PreferenceController } from './controller/preference.controller';
import { PREFERENCE_REPOSITORY } from './domain/preference.repository';
import { PreferenceOrmEntity } from './repository/preference.orm-entity';
import { PreferenceTypeormRepository } from './repository/preference.typeorm.repository';
import { PreferenceService } from './service/preference.service';

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
