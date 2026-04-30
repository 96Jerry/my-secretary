import { Global, Module } from '@nestjs/common';

import { env } from './env.js';
import { EnvironmentVariables } from './env.validation.js';

@Global()
@Module({
  providers: [{ provide: EnvironmentVariables, useValue: env }],
  exports: [EnvironmentVariables],
})
export class EnvModule {}
