import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HealthController } from './controller/health.controller.js';
import { HEALTH_REPOSITORY } from './domain/health.repository.js';
import { HealthOrmEntity } from './repository/health.orm-entity.js';
import { HealthTypeormRepository } from './repository/health.typeorm.repository.js';
import { HealthService } from './service/health.service.js';

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
