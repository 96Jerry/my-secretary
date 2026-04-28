import { Global, Module } from '@nestjs/common';

import { env } from './env';
import { EnvironmentVariables } from './env.validation';

@Global()
@Module({
  providers: [{ provide: EnvironmentVariables, useValue: env }],
  exports: [EnvironmentVariables],
})
export class EnvModule {}
