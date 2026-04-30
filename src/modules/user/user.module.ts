import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserController } from './controller/user.controller.js';
import { USER_REPOSITORY } from './domain/user.repository.js';
import { UserOrmEntity } from './repository/user.orm-entity.js';
import { UserTypeormRepository } from './repository/user.typeorm.repository.js';
import { UserService } from './service/user.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UserController],
  providers: [
    UserService,
    { provide: USER_REPOSITORY, useClass: UserTypeormRepository },
  ],
  exports: [UserService],
})
export class UserModule {}
