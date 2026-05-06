import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MealLogController } from './controller/meal-log.controller.js';
import { MEAL_LOG_REPOSITORY } from './domain/meal-log.repository.js';
import { MealLogOrmEntity } from './repository/meal-log.orm-entity.js';
import { MealLogTypeormRepository } from './repository/meal-log.typeorm.repository.js';
import { MealLogService } from './service/meal-log.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([MealLogOrmEntity])],
  controllers: [MealLogController],
  providers: [
    MealLogService,
    { provide: MEAL_LOG_REPOSITORY, useClass: MealLogTypeormRepository },
  ],
  exports: [MealLogService],
})
export class MealLogModule {}
