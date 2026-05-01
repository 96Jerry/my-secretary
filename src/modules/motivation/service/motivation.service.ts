import { Inject, Injectable, Logger } from '@nestjs/common';

import { MailService } from '../../../infrastructure/mail/mail.service.js';
import { UserService } from '../../user/service/user.service.js';
import {
  MOTIVATION_MESSAGE_REPOSITORY,
  type MotivationMessageRepository,
} from '../domain/motivation-message.repository.js';
import { MotivationProfile } from '../domain/motivation-profile.entity.js';
import {
  MOTIVATION_PROFILE_REPOSITORY,
  type MotivationProfileRepository,
} from '../domain/motivation-profile.repository.js';
import { MotivationComposerService } from './motivation-composer.service.js';
import { MotivationRewriterService } from './motivation-rewriter.service.js';

@Injectable()
export class MotivationService {
  private readonly logger = new Logger(MotivationService.name);

  constructor(
    @Inject(MOTIVATION_PROFILE_REPOSITORY)
    private readonly profileRepo: MotivationProfileRepository,
    @Inject(MOTIVATION_MESSAGE_REPOSITORY)
    private readonly messageRepo: MotivationMessageRepository,
    private readonly userService: UserService,
    private readonly rewriter: MotivationRewriterService,
    private readonly composer: MotivationComposerService,
    private readonly mailService: MailService,
  ) {}

  async runDailyForAll(): Promise<void> {
    const sentDate = todayKstDate();
    const profiles = await this.profileRepo.findAllEnabled();
    this.logger.log(
      `동기부여 메시지 발송 시작: 대상 ${profiles.length}명, 기준일 ${sentDate}`,
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const profile of profiles) {
      try {
        const result = await this.runForProfile(profile, sentDate);
        if (result === 'sent') sent++;
        else skipped++;
      } catch (e) {
        failed++;
        this.logger.error(
          `사용자 ${profile.userId} 발송 실패: ${(e as Error).message}`,
          (e as Error).stack,
        );
      }
    }
    this.logger.log(
      `동기부여 메시지 발송 종료: sent=${sent}, skipped=${skipped}, failed=${failed}`,
    );
  }

  private async runForProfile(
    profile: MotivationProfile,
    sentDate: string,
  ): Promise<'sent' | 'skipped'> {
    if (await this.messageRepo.existsForDate(profile.userId, sentDate)) {
      this.logger.log(
        `사용자 ${profile.userId}: ${sentDate} 이미 발송됨, skip`,
      );
      return 'skipped';
    }

    const user = await this.userService.findById(profile.userId);
    if (!user.email) {
      this.logger.warn(`사용자 ${profile.userId}: 이메일 없음, skip`);
      return 'skipped';
    }

    const [rewrittenGoal, rewrittenSituation] = await Promise.all([
      this.rewriter.rewriteGoalIfChanged(profile),
      this.rewriter.rewriteSituationIfChanged(profile),
    ]);

    if (!rewrittenGoal || !rewrittenSituation) {
      this.logger.warn(
        `사용자 ${profile.userId}: 재작성된 goal/situation 부족 (goal=${!!rewrittenGoal}, situation=${!!rewrittenSituation}), skip`,
      );
      return 'skipped';
    }

    const previous = await this.messageRepo.findLatestByUserId(profile.userId);
    const content = await this.composer.compose({
      rewrittenGoal,
      rewrittenSituation,
      daysNotStudied: profile.daysNotStudied,
      previousOutput: previous?.content ?? null,
    });

    await this.mailService.send({
      to: user.email,
      subject: `오늘의 동기부여 — ${sentDate}`,
      html: toHtml(content),
    });

    await this.messageRepo.save({
      userId: profile.userId,
      sentDate,
      content,
      daysNotStudiedAtSend: profile.daysNotStudied,
    });

    this.logger.log(`사용자 ${profile.userId}: ${sentDate} 발송 완료`);
    return 'sent';
  }
}

// Asia/Seoul 기준 YYYY-MM-DD. en-CA 로케일은 항상 ISO 형식 출력.
function todayKstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// LLM 결과(plain text)를 단순 <p> 래핑으로 HTML 메일 본문으로 변환.
function toHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
