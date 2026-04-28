import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HealthController } from './controller/health.controller';
import { HEALTH_REPOSITORY } from './domain/health.repository';
import { HealthOrmEntity } from './repository/health.orm-entity';
import { HealthTypeormRepository } from './repository/health.typeorm.repository';
import { HealthService } from './service/health.service';

@Module({
  imports: [TypeOrmModule.forFeature([HealthOrmEntity])],
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: HEALTH_REPOSITORY, useClass: HealthTypeormRepository },
  ],
  exports: [HealthService],
})
export class HealthModule {}
