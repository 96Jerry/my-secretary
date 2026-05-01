import { ConsoleLogger, Injectable } from '@nestjs/common';

import { DiscordErrorReporter } from './discord-error-reporter.service.js';

@Injectable()
export class DiscordWebhookLogger extends ConsoleLogger {
  constructor(private readonly reporter: DiscordErrorReporter) {
    super();
  }

  // NestJS Logger.error 호출 형태:
  //   error(message)
  //   error(message, stack?)
  //   error(message, stack?, context?)
  //   error(message, error, context?)
  // 마지막 인자가 문자열이면 context로 간주.
  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...(optionalParams as string[]));

    let context: string | undefined;
    const rest = [...optionalParams];
    if (rest.length > 0 && typeof rest[rest.length - 1] === 'string') {
      const last = rest[rest.length - 1] as string;
      // 스택 트레이스는 줄바꿈 포함 → context는 한 줄짜리 식별자만
      if (!last.includes('\n')) {
        context = last;
        rest.pop();
      }
    }

    const stack = extractStack(message, rest);
    const text = toMessageText(message);

    void this.reporter.report({ message: text, stack, context });
  }
}

function extractStack(message: unknown, rest: unknown[]): string | undefined {
  if (message instanceof Error && message.stack) return message.stack;
  for (const p of rest) {
    if (p instanceof Error && p.stack) return p.stack;
    if (typeof p === 'string' && p.includes('\n')) return p;
  }
  return undefined;
}

function toMessageText(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}
