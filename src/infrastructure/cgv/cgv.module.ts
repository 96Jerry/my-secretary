import { Module } from '@nestjs/common';

import { CgvScheduleService } from './cgv-schedule.service.js';

@Module({
  providers: [CgvScheduleService],
  exports: [CgvScheduleService],
})
export class CgvModule {}
