import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FridgeController } from './controller/fridge.controller.js';
import { FRIDGE_REPOSITORY } from './domain/fridge.repository.js';
import { FridgeOrmEntity } from './repository/fridge.orm-entity.js';
import { FridgeTypeormRepository } from './repository/fridge.typeorm.repository.js';
import { FridgeService } from './service/fridge.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FridgeOrmEntity])],
  controllers: [FridgeController],
  providers: [
    FridgeService,
    { provide: FRIDGE_REPOSITORY, useClass: FridgeTypeormRepository },
  ],
  exports: [FridgeService],
})
export class FridgeModule {}
