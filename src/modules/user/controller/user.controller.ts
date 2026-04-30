import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { User } from '../domain/user.entity.js';
import { UserService } from '../service/user.service.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.userService.findById(id);
  }
}
