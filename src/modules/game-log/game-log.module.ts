import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GameLogController } from './controller/game-log.controller.js';
import { GAME_SESSION_REPOSITORY } from './domain/game-session.repository.js';
import { GameSessionOrmEntity } from './repository/game-session.orm-entity.js';
import { GameSessionTypeormRepository } from './repository/game-session.typeorm.repository.js';
import { GameLogService } from './service/game-log.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([GameSessionOrmEntity])],
  controllers: [GameLogController],
  providers: [
    GameLogService,
    {
      provide: GAME_SESSION_REPOSITORY,
      useClass: GameSessionTypeormRepository,
    },
  ],
  exports: [GameLogService],
})
export class GameLogModule {}
