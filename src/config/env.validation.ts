import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

// implicit conversion이 'false' 문자열을 true로 바꾸는 것을 피하기 위해
// 변환 전 원본 값(obj[key])을 직접 읽어 판단한다.
const toBoolean = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): boolean => {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  return String(raw).toLowerCase() === 'true';
};

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DB_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  DB_SYNCHRONIZE: boolean = false;

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  DB_LOGGING: boolean = false;

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  DB_SSL: boolean = false;

  @IsString()
  CLAUDE_CODE_OAUTH_TOKEN!: string;

  @IsString()
  @IsOptional()
  CLAUDE_CODE_PATH?: string;

  @IsString()
  @IsOptional()
  CLAUDE_MODEL: string = 'claude-opus-4-7';

  @IsString()
  DISCORD_BOT_TOKEN!: string;

  // 미설정 시 디스코드 알림 비활성화 (로컬/테스트 편의)
  @IsString()
  @IsOptional()
  DISCORD_ERROR_WEBHOOK_URL?: string;

  @IsString()
  MAIL_HOST!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  MAIL_PORT!: number;

  @IsString()
  MAIL_USER!: string;

  @IsString()
  MAIL_PASSWORD!: string;

  @IsString()
  MAIL_FROM!: string;

  @IsEmail()
  MEAL_PLAN_RECIPIENT!: string;

  @IsString()
  @IsOptional()
  MEAL_PLAN_CRON: string = '0 6 * * *';

  @IsString()
  @IsOptional()
  MOTIVATION_CRON: string = '0 6 * * *';

  @IsString()
  @IsOptional()
  EVENING_COLLECTION_CRON: string = '0 22 * * *';

  // 팰월드 패치노트 알림 수신자
  @IsEmail()
  PALWORLD_NEWS_RECIPIENT!: string;

  @IsString()
  @IsOptional()
  PALWORLD_NEWS_CRON: string = '0 9 * * *';

  // CGV 용산아이파크몰 IMAX 신규 회차 알림 수신자
  @IsEmail()
  CGV_IMAX_RECIPIENT!: string;

  // 감시할 영화 제목(쉼표 구분, 부분 일치·공백/대소문자 무시).
  // 국문/영문 제목 모두 인식한다. 예: '오디세이,아바타' 또는 'Odyssey,Avatar'
  @IsString()
  CGV_IMAX_MOVIES!: string;

  // 예매 오픈 직후 좌석이 빠르게 나가므로 1분 간격으로 확인한다.
  // 매 분 전체 날짜를 긁지는 않고(FRONTIER_DAYS 참고), 알림 보낸 회차는 메모리
  // 캐시로 비교하므로 짧은 주기여도 DB와 CGV 양쪽 부하가 크지 않다.
  @IsString()
  @IsOptional()
  CGV_IMAX_CRON: string = '* * * * *';

  // NestJS Observe 자격 증명
  @IsString()
  OBSERVE_APP_KEY!: string;

  @IsString()
  OBSERVE_APP_SECRET!: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }
  return validated;
}
