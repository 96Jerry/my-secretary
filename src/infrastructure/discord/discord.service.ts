import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type Guild,
  Message,
  TextChannel,
} from 'discord.js';

import { EnvironmentVariables } from '@config/index.js';
import { FridgeService } from '@modules/fridge/service/fridge.service.js';
import { HealthService } from '@modules/health/service/health.service.js';
import type { MealSlot } from '@modules/meal-log/domain/meal-log.entity.js';
import { MealLogService } from '@modules/meal-log/service/meal-log.service.js';
import { PreferenceService } from '@modules/preference/service/preference.service.js';
import { ScheduleService } from '@modules/schedule/service/schedule.service.js';
import { SituationService } from '@modules/situation/service/situation.service.js';
import { User } from '@modules/user/domain/user.entity.js';
import { UserService } from '@modules/user/service/user.service.js';
import {
  FridgeItem,
  IntentContext,
  IntentParserService,
  ParsedIntent,
} from './intent-parser.service.js';

type Category = 'fridge' | 'health' | 'preference' | 'schedule';

type PendingUpdate =
  | { kind: 'fridge'; items: FridgeItem[]; summary: string }
  | { kind: 'health'; data: Record<string, unknown>; summary: string }
  | { kind: 'preference'; data: Record<string, unknown>; summary: string }
  | {
      kind: 'schedule';
      date: string;
      data: Record<string, unknown>;
      summary: string;
    }
  | { kind: 'situation'; data: Record<string, unknown>; summary: string }
  | {
      kind: 'meal_log';
      date: string;
      slot: MealSlot;
      data: Record<string, unknown>;
      summary: string;
    };

const CHANNEL_NAME = 'daily-meal-plan';

const WELCOME_INTRO =
  '안녕하세요. 시작하려면 4개 정보(냉장고, 건강, 선호, 일정)를 알려주세요. 자유 순서로 보내셔도 됩니다.';
const WELCOME_RETURNING =
  '안녕하세요. 다시 만났네요. 자유롭게 업데이트 요청해 주세요.';
const ONBOARDING_DONE =
  '\n\n초기 설정 완료. 이제 자유롭게 업데이트 요청해 주세요.';

const PROMPTS: Record<Category, string> = {
  fridge:
    '냉장고에 있는 식재료를 알려주세요. 예: `닭가슴살 800g, 계란 10개, 양파 2개`',
  health:
    '건강 정보를 알려주세요 (목표, 나이, 키, 체중, 알레르기). 예: `30살 남성, 168cm 65kg, 근성장 목표, 키위 알레르기`',
  preference:
    '식사 선호를 알려주세요. 예: `한식과 일식 좋아함, 배달은 교촌, 외식 가능`',
  schedule:
    '오늘 일정을 알려주세요 (수면, 약속, 운동). 예: `7시 기상 23시 취침, 14시 회의, 저녁 7시 운동`',
};

const CATEGORY_LABEL: Record<Category, string> = {
  fridge: '냉장고',
  health: '건강',
  preference: '선호',
  schedule: '일정',
};

const AFFIRMATIVE =
  /^(예|네|응|어|ㅇㅇ|맞아|맞음|좋아|좋습니다|ok|yes|y)\s*[.!]*$/i;
const NEGATIVE = /^(아니|아니야|아니오|아뇨|싫어|취소|no|n)\s*[.!]*$/i;

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client!: Client;
  private readonly botChannelByGuild = new Map<string, string>();
  private readonly pendingByGuild = new Map<string, PendingUpdate>();

  constructor(
    private readonly env: EnvironmentVariables,
    private readonly userService: UserService,
    private readonly fridgeService: FridgeService,
    private readonly healthService: HealthService,
    private readonly preferenceService: PreferenceService,
    private readonly scheduleService: ScheduleService,
    private readonly situationService: SituationService,
    private readonly mealLogService: MealLogService,
    private readonly intentParser: IntentParserService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.once('clientReady', (c) => {
      this.logger.log(`Discord 봇 로그인: ${c.user.tag}`);
      for (const guild of c.guilds.cache.values()) {
        const ch = findBotChannel(guild);
        if (ch) {
          this.botChannelByGuild.set(guild.id, ch.id);
          this.logger.log(`길드 ${guild.name}: #${ch.name} 등록`);
        } else {
          this.logger.warn(
            `길드 ${guild.name}에 #${CHANNEL_NAME} 채널 없음 — 비활성`,
          );
        }
      }
    });

    this.client.on('guildCreate', (guild) => {
      void this.onGuildJoined(guild).catch((e) => {
        this.logger.error(
          `길드 가입 처리 실패 (${guild.name}): ${(e as Error).message}`,
          e,
        );
      });
    });

    this.client.on('guildDelete', (guild) => {
      this.botChannelByGuild.delete(guild.id);
      this.pendingByGuild.delete(guild.id);
    });

    this.client.on('channelCreate', (ch) => {
      if (ch.type !== ChannelType.GuildText) return;
      if (ch.name !== CHANNEL_NAME) return;
      if (this.botChannelByGuild.has(ch.guild.id)) return;
      this.botChannelByGuild.set(ch.guild.id, ch.id);
      this.logger.log(`길드 ${ch.guild.name}: #${ch.name} 재생성 감지 — 활성`);
      void this.sendDynamicWelcome(ch).catch((e) => {
        this.logger.error(`환영 메시지 발송 실패: ${(e as Error).message}`, e);
      });
    });

    this.client.on('channelDelete', (ch) => {
      if (ch.isDMBased()) return;
      const registered = this.botChannelByGuild.get(ch.guild.id);
      if (registered === ch.id) {
        this.botChannelByGuild.delete(ch.guild.id);
        this.pendingByGuild.delete(ch.guild.id);
        this.logger.log(
          `길드 ${ch.guild.name}: #${CHANNEL_NAME} 삭제 감지 — 비활성`,
        );
      }
    });

    this.client.on('messageCreate', (msg) => {
      void this.handleMessage(msg).catch((e) => {
        this.logger.error(`메시지 처리 실패: ${(e as Error).message}`, e);
      });
    });

    await this.client.login(this.env.DISCORD_BOT_TOKEN);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.destroy();
  }

  private async onGuildJoined(guild: Guild): Promise<void> {
    const user = await this.userService.findOrCreateByGuildId(
      guild.id,
      guild.name,
    );

    let channel = findBotChannel(guild);
    if (channel) {
      this.logger.log(`길드 ${guild.name}: 기존 #${channel.name} 재사용`);
    } else {
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        reason: 'My Secretary 봇 초기 채널',
      });
      this.logger.log(`길드 ${guild.name}: #${channel.name} 생성`);
    }
    this.botChannelByGuild.set(guild.id, channel.id);

    await channel.send(await this.welcomeFor(user.id));
  }

  private async sendDynamicWelcome(channel: TextChannel): Promise<void> {
    const user = await this.userService.findOrCreateByGuildId(
      channel.guild.id,
      channel.guild.name,
    );
    await channel.send(await this.welcomeFor(user.id));
  }

  private async handleMessage(msg: Message): Promise<void> {
    if (msg.author.bot) return;
    const guildId = msg.guildId;
    if (!guildId) return;

    const botChannelId = this.botChannelByGuild.get(guildId);
    if (!botChannelId || botChannelId !== msg.channelId) return;

    const text = msg.content.trim();
    if (!text) return;

    const user = await this.userService.findOrCreateByGuildId(
      guildId,
      msg.guild?.name ?? null,
    );

    const pending = this.pendingByGuild.get(guildId);
    if (pending) {
      if (AFFIRMATIVE.test(text)) {
        const wasIncomplete = (await this.findNextMissing(user.id)) !== null;
        await this.applyPending(user.id, pending);
        this.pendingByGuild.delete(guildId);
        const tail = await this.tailFor(user.id, wasIncomplete);
        await msg.reply(`${confirmedMessage(pending)}${tail}`);
        return;
      }
      if (NEGATIVE.test(text)) {
        this.pendingByGuild.delete(guildId);
        await msg.reply('취소했습니다.');
        return;
      }
      // 명확하지 않은 응답은 보류를 폐기하고 새 메시지로 처리
      this.pendingByGuild.delete(guildId);
    }

    const today = todayIso();
    const [fridge, health, preference, schedule, situation] = await Promise.all(
      [
        this.fridgeService.getLatest(user.id),
        this.healthService.getLatest(user.id),
        this.preferenceService.getLatest(user.id),
        this.scheduleService.getForDate(user.id, today),
        this.situationService.getLatest(user.id),
      ],
    );

    const ctx: IntentContext = {
      today,
      fridge: { items: readItems(fridge?.data) },
      health: health?.data ?? null,
      preference: preference?.data ?? null,
      schedule: schedule?.data ?? null,
      situation: situation?.data ?? null,
    };

    const parsed = await this.intentParser.parse(text, ctx);

    if (parsed.intent === 'other') {
      const tail = await this.tailFor(user.id, false);
      await msg.reply(
        `냉장고, 건강, 선호, 일정, 상황, 식사 기록 업데이트만 가능합니다.${tail}`,
      );
      return;
    }

    const next = toPending(parsed);
    if (!next) {
      const tail = await this.tailFor(user.id, false);
      await msg.reply(`처리할 변경 내용이 없습니다.${tail}`);
      return;
    }

    this.pendingByGuild.set(guildId, next);
    await msg.reply(
      [askQuestion(next), next.summary || '(요약 없음)'].join('\n'),
    );
  }

  private async applyPending(userId: string, p: PendingUpdate): Promise<void> {
    switch (p.kind) {
      case 'fridge':
        await this.fridgeService.upsert(userId, { items: p.items });
        return;
      case 'health':
        await this.healthService.upsert(userId, p.data);
        return;
      case 'preference':
        await this.preferenceService.upsert(userId, p.data);
        return;
      case 'schedule':
        await this.scheduleService.upsert(userId, p.date, p.data);
        return;
      case 'situation':
        await this.situationService.upsert(userId, p.data);
        return;
      case 'meal_log':
        await this.mealLogService.upsert(userId, p.date, p.slot, p.data);
        return;
    }
  }

  private async findMissingCategories(userId: string): Promise<Category[]> {
    const today = todayIso();
    const [fridge, health, preference, schedule] = await Promise.all([
      this.fridgeService.getLatest(userId),
      this.healthService.getLatest(userId),
      this.preferenceService.getLatest(userId),
      this.scheduleService.getForDate(userId, today),
    ]);
    const missing: Category[] = [];
    if (!fridge) missing.push('fridge');
    if (!health) missing.push('health');
    if (!preference) missing.push('preference');
    if (!schedule) missing.push('schedule');
    return missing;
  }

  private async findNextMissing(userId: string): Promise<Category | null> {
    const missing = await this.findMissingCategories(userId);
    return missing[0] ?? null;
  }

  /**
   * 저녁 수집 cron 호출. 식사 기록과 내일 일정을 묻는 두 메시지를 봇 채널로 발송.
   */
  async promptEveningCollection(user: User): Promise<void> {
    if (!user.guildId) return;

    const channelId = this.botChannelByGuild.get(user.guildId);
    if (!channelId) {
      this.logger.warn(
        `사용자 ${user.id} (guild ${user.guildId}): 봇 채널 미등록 — 저녁 수집 스킵`,
      );
      return;
    }

    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased() || !channel.isSendable()) {
      this.logger.warn(`채널 ${channelId} 발송 불가 — 저녁 수집 스킵`);
      return;
    }

    await channel.send(
      '오늘 식사를 끼니별로 알려주세요. 예: `점심에 김치찌개. 주재료 돼지고기·김치, 조리법 끓임`',
    );
    await channel.send(
      '내일 일정을 알려주세요. 다른 날짜도 가능합니다. 예: `내일 14시 미팅, 18시 약속`',
    );
  }

  /**
   * cron에서 호출. 사용자의 비어 있는 카테고리가 있으면 해당 길드 봇 채널로
   * 입력 요청 메시지를 발송. 채널 미등록 시 경고 로그 남기고 스킵.
   */
  async notifyIfMissingSettings(user: User): Promise<void> {
    if (!user.guildId) return;

    const missing = await this.findMissingCategories(user.id);
    if (missing.length === 0) return;

    const channelId = this.botChannelByGuild.get(user.guildId);
    if (!channelId) {
      this.logger.warn(
        `사용자 ${user.id} (guild ${user.guildId}): 봇 채널 미등록 — 알림 스킵`,
      );
      return;
    }

    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased() || !channel.isSendable()) {
      this.logger.warn(`채널 ${channelId} 발송 불가 — 알림 스킵`);
      return;
    }

    const labels = missing.map((c) => CATEGORY_LABEL[c]).join(', ');
    await channel.send(
      `오늘 식단은 ${labels} 정보없이 발송되었습니다. 발송 전 채널에 입력하는걸 잊지 말아주세요.`,
    );
  }

  private async tailFor(
    userId: string,
    wasIncomplete: boolean,
  ): Promise<string> {
    const next = await this.findNextMissing(userId);
    if (next) return `\n\n다음으로 ${PROMPTS[next]}`;
    if (wasIncomplete) return ONBOARDING_DONE;
    return '';
  }

  private async welcomeFor(userId: string): Promise<string> {
    const next = await this.findNextMissing(userId);
    if (!next) return WELCOME_RETURNING;
    return `${WELCOME_INTRO}\n\n먼저, ${PROMPTS[next]}`;
  }
}

function toPending(parsed: ParsedIntent): PendingUpdate | null {
  switch (parsed.intent) {
    case 'update_fridge':
      return parsed.items.length === 0
        ? null
        : { kind: 'fridge', items: parsed.items, summary: parsed.summary };
    case 'update_health':
      return Object.keys(parsed.data).length === 0
        ? null
        : { kind: 'health', data: parsed.data, summary: parsed.summary };
    case 'update_preference':
      return Object.keys(parsed.data).length === 0
        ? null
        : { kind: 'preference', data: parsed.data, summary: parsed.summary };
    case 'update_schedule':
      if (!parsed.date || Object.keys(parsed.data).length === 0) return null;
      return {
        kind: 'schedule',
        date: parsed.date,
        data: parsed.data,
        summary: parsed.summary,
      };
    case 'update_situation':
      return Object.keys(parsed.data).length === 0
        ? null
        : { kind: 'situation', data: parsed.data, summary: parsed.summary };
    case 'update_meal_log':
      if (!parsed.date || Object.keys(parsed.data).length === 0) return null;
      return {
        kind: 'meal_log',
        date: parsed.date,
        slot: parsed.slot,
        data: parsed.data,
        summary: parsed.summary,
      };
    case 'other':
      return null;
  }
}

function askQuestion(p: PendingUpdate): string {
  switch (p.kind) {
    case 'fridge':
      return '냉장고 업데이트할까요? (예/아니오)';
    case 'health':
      return '건강 정보 업데이트할까요? (예/아니오)';
    case 'preference':
      return '선호 업데이트할까요? (예/아니오)';
    case 'schedule':
      return `일정(${p.date}) 업데이트할까요? (예/아니오)`;
    case 'situation':
      return '상황 업데이트할까요? (예/아니오)';
    case 'meal_log':
      return `식사 기록(${p.date} ${p.slot}) 저장할까요? (예/아니오)`;
  }
}

function confirmedMessage(p: PendingUpdate): string {
  switch (p.kind) {
    case 'fridge':
      return '냉장고 업데이트 완료.';
    case 'health':
      return '건강 정보 업데이트 완료.';
    case 'preference':
      return '선호 업데이트 완료.';
    case 'schedule':
      return `일정(${p.date}) 업데이트 완료.`;
    case 'situation':
      return '상황 업데이트 완료.';
    case 'meal_log':
      return `식사 기록(${p.date} ${p.slot}) 저장 완료.`;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function findBotChannel(guild: Guild): TextChannel | undefined {
  return guild.channels.cache.find(
    (c): c is TextChannel =>
      c.type === ChannelType.GuildText && c.name === CHANNEL_NAME,
  );
}

function readItems(data: Record<string, unknown> | undefined): FridgeItem[] {
  const items = data?.items;
  return Array.isArray(items) ? (items as FridgeItem[]) : [];
}
