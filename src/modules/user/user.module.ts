import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserController } from './controller/user.controller';
import { USER_REPOSITORY } from './domain/user.repository';
import { UserOrmEntity } from './repository/user.orm-entity';
import { UserTypeormRepository } from './repository/user.typeorm.repository';
import { UserService } from './service/user.service';

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
