import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FridgeController } from './controller/fridge.controller';
import { FRIDGE_REPOSITORY } from './domain/fridge.repository';
import { FridgeOrmEntity } from './repository/fridge.orm-entity';
import { FridgeTypeormRepository } from './repository/fridge.typeorm.repository';
import { FridgeService } from './service/fridge.service';

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
