import { Injectable } from '@nestjs/common';

import { EnvironmentVariables } from '@config/index.js';

export interface ErrorReport {
  message: string;
  stack?: string;
  context?: string;
}

// 디스코드 embed 필드값 한도
const FIELD_VALUE_MAX = 1024;
const STACK_INNER_MAX = FIELD_VALUE_MAX - '```\n\n```'.length;

@Injectable()
export class DiscordErrorReporter {
  constructor(private readonly env: EnvironmentVariables) {}

  async report(payload: ErrorReport): Promise<void> {
    const url = this.env.DISCORD_ERROR_WEBHOOK_URL;
    if (!url) return;

    const fields: { name: string; value: string }[] = [
      {
        name: '메시지',
        value: truncate(payload.message || '(메시지 없음)', FIELD_VALUE_MAX),
      },
    ];
    if (payload.stack) {
      fields.push({
        name: '스택',
        value: '```\n' + truncate(payload.stack, STACK_INNER_MAX) + '\n```',
      });
    }

    const body = {
      embeds: [
        {
          title: payload.context
            ? `[${truncate(payload.context, 240)}] 에러 발생`
            : '에러 발생',
          color: 0xe74c3c,
          timestamp: new Date().toISOString(),
          fields,
        },
      ],
    };

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Logger 경유 시 무한루프 위험이 있어 console 직사용
      console.error('[DiscordErrorReporter] 웹훅 전송 실패', e);
    }
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}
