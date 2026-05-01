import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClaudeModule } from '../../infrastructure/claude/claude.module.js';
import { MailModule } from '../../infrastructure/mail/mail.module.js';
import { UserModule } from '../user/user.module.js';
import { MOTIVATION_MESSAGE_REPOSITORY } from './domain/motivation-message.repository.js';
import { MOTIVATION_PROFILE_REPOSITORY } from './domain/motivation-profile.repository.js';
import { MotivationMessageOrmEntity } from './repository/motivation-message.orm-entity.js';
import { MotivationMessageTypeormRepository } from './repository/motivation-message.typeorm.repository.js';
import { MotivationProfileOrmEntity } from './repository/motivation-profile.orm-entity.js';
import { MotivationProfileTypeormRepository } from './repository/motivation-profile.typeorm.repository.js';
import { MotivationComposerService } from './service/motivation-composer.service.js';
import { MotivationRewriterService } from './service/motivation-rewriter.service.js';
import { MotivationService } from './service/motivation.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MotivationProfileOrmEntity,
      MotivationMessageOrmEntity,
    ]),
    UserModule,
    ClaudeModule,
    MailModule,
  ],
  providers: [
    {
      provide: MOTIVATION_PROFILE_REPOSITORY,
      useClass: MotivationProfileTypeormRepository,
    },
    {
      provide: MOTIVATION_MESSAGE_REPOSITORY,
      useClass: MotivationMessageTypeormRepository,
    },
    MotivationRewriterService,
    MotivationComposerService,
    MotivationService,
  ],
  exports: [MotivationService],
})
export class MotivationModule {}
