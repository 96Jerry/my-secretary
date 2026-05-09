import { Module } from '@nestjs/common';
import { ResourceProfilerService } from './resource-profiler.service.js';

@Module({
  providers: [ResourceProfilerService],
  exports: [ResourceProfilerService],
})
export class ProfilerModule {}
