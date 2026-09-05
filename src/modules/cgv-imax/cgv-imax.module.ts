import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CgvModule } from '@infra/cgv/cgv.module.js';
import { MailModule } from '@infra/mail/mail.module.js';
import { CGV_IMAX_REPOSITORY } from './domain/cgv-imax.repository.js';
import { CgvImaxOpenedDateOrmEntity } from './repository/cgv-imax-opened-date.orm-entity.js';
import { CgvImaxShowtimeOrmEntity } from './repository/cgv-imax-showtime.orm-entity.js';
import { CgvImaxTypeormRepository } from './repository/cgv-imax.typeorm.repository.js';
import { CgvImaxService } from './service/cgv-imax.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CgvImaxShowtimeOrmEntity,
      CgvImaxOpenedDateOrmEntity,
    ]),
    CgvModule,
    MailModule,
  ],
  providers: [
    {
      provide: CGV_IMAX_REPOSITORY,
      useClass: CgvImaxTypeormRepository,
    },
    CgvImaxService,
  ],
  exports: [CgvImaxService],
})
export class CgvImaxModule {}
