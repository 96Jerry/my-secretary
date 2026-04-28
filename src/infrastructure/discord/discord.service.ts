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

import { EnvironmentVariables } from '../../config';
import { FridgeService } from '../../modules/fridge/service/fridge.service';
import { FridgeItem, IntentParserService } from './intent-parser.service';

interface PendingFridgeUpdate {
  items: FridgeItem[];
  summary: string;
}

const CHANNEL_NAME = 'daily-meal-plan';
const WELCOME =
  "안녕하세요. 이 채널에서 냉장고 업데이트 요청을 받습니다. 예: '닭가슴살 200g 추가해줘'";

const AFFIRMATIVE =
  /^(예|네|응|어|ㅇㅇ|맞아|맞음|좋아|좋습니다|ok|yes|y)\s*[.!]*$/i;
const NEGATIVE = /^(아니|아니야|아니오|아뇨|싫어|취소|no|n)\s*[.!]*$/i;

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client!: Client;
  private readonly botChannelByGuild = new Map<string, string>();
  private readonly pendingByGuild = new Map<string, PendingFridgeUpdate>();

  constructor(
    private readonly env: EnvironmentVariables,
    private readonly fridgeService: FridgeService,
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
      // 재시작 시 기존 채널만 등록 (새로 만들지 않음)
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
      void ch.send(WELCOME).catch(() => {});
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
    await channel.send(WELCOME);
  }

  private async handleMessage(msg: Message): Promise<void> {
    if (msg.author.bot) return;
    const guildId = msg.guildId;
    if (!guildId) return;

    const botChannelId = this.botChannelByGuild.get(guildId);
    if (!botChannelId || botChannelId !== msg.channelId) return;

    const text = msg.content.trim();
    if (!text) return;

    const pending = this.pendingByGuild.get(guildId);
    if (pending) {
      if (AFFIRMATIVE.test(text)) {
        await this.fridgeService.upsert(guildId, { items: pending.items });
        this.pendingByGuild.delete(guildId);
        await msg.reply('냉장고 업데이트 완료.');
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

    const fridge = await this.fridgeService.getLatest(guildId);
    const currentItems = readItems(fridge?.data);

    const parsed = await this.intentParser.parse(text, currentItems);

    if (parsed.intent !== 'update_fridge' || !parsed.items?.length) {
      await msg.reply('지금은 냉장고 재고 업데이트만 가능합니다.');
      return;
    }

    this.pendingByGuild.set(guildId, {
      items: parsed.items,
      summary: parsed.summary ?? '',
    });
    await msg.reply(
      [
        '이대로 업데이트할까요? (예/아니오)',
        parsed.summary || '(요약 없음)',
      ].join('\n'),
    );
  }
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
