import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { buildTypeOrmOptions } from './typeorm-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => buildTypeOrmOptions() }),
  ],
})
export class DatabaseModule {}
