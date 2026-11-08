import { Controller, Get } from '@nestjs/common';

// 프로세스 생존 확인용. /health는 사용자 건강 프로필(users/:userId/health)과 헷갈려 피한다.
@Controller()
export class AppController {
  @Get('healthz')
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
