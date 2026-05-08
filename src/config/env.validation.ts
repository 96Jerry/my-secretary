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
