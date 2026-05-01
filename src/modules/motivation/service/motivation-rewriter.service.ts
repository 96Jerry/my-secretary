import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { ClaudeService } from '../../../infrastructure/claude/claude.service.js';
import { MotivationProfile } from '../domain/motivation-profile.entity.js';
import {
  MOTIVATION_PROFILE_REPOSITORY,
  type MotivationProfileRepository,
} from '../domain/motivation-profile.repository.js';
import { buildRewriteGoalPrompt } from '../domain/prompts/rewrite-goal.prompt.js';
import { buildRewriteSituationPrompt } from '../domain/prompts/rewrite-situation.prompt.js';
import { withTimeout } from './timeout.js';

const LLM_TIMEOUT_MS = 20_000;

@Injectable()
export class MotivationRewriterService {
  private readonly logger = new Logger(MotivationRewriterService.name);

  constructor(
    @Inject(MOTIVATION_PROFILE_REPOSITORY)
    private readonly profileRepo: MotivationProfileRepository,
    private readonly claudeService: ClaudeService,
  ) {}

  // goal 변경 시 프롬프트 1 호출, hash 일치하면 캐시 반환.
  async rewriteGoalIfChanged(
    profile: MotivationProfile,
  ): Promise<string | null> {
    if (!profile.goal) return null;
    const hash = sha256(profile.goal);
    if (hash === profile.goalHash && profile.rewrittenGoal) {
      return profile.rewrittenGoal;
    }
    this.logger.log(`목표 변경 감지: user=${profile.userId}, 프롬프트 1 호출`);
    const rewritten = await withTimeout(
      this.claudeService.run(buildRewriteGoalPrompt(profile.goal)),
      LLM_TIMEOUT_MS,
      'rewriteGoal',
    );
    await this.profileRepo.updateGoalCache(profile.userId, rewritten, hash);
    return rewritten;
  }

  // situation 변경 시 프롬프트 2 호출, hash 일치하면 캐시 반환.
  async rewriteSituationIfChanged(
    profile: MotivationProfile,
  ): Promise<string | null> {
    if (!profile.situation) return null;
    const hash = sha256(profile.situation);
    if (hash === profile.situationHash && profile.rewrittenSituation) {
      return profile.rewrittenSituation;
    }
    this.logger.log(
      `현재 상황 변경 감지: user=${profile.userId}, 프롬프트 2 호출`,
    );
    const rewritten = await withTimeout(
      this.claudeService.run(buildRewriteSituationPrompt(profile.situation)),
      LLM_TIMEOUT_MS,
      'rewriteSituation',
    );
    await this.profileRepo.updateSituationCache(
      profile.userId,
      rewritten,
      hash,
    );
    return rewritten;
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
