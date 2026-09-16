// @config/index.js는 임포트 시점에 process.env를 검증한다. 단위 테스트는 실제
// 자격 증명이 필요 없으므로 형식만 맞는 더미 값을 채워 넣는다.
const DUMMY_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'test',
  DB_SSL: 'false',
  CLAUDE_CODE_OAUTH_TOKEN: 'test',
  CLAUDE_CODE_PATH: 'test',
  CLAUDE_MODEL: 'test',
  MAIL_HOST: 'localhost',
  MAIL_PORT: '587',
  MAIL_USER: 'test',
  MAIL_PASSWORD: 'test',
  MAIL_FROM: 'test@example.com',
  MEAL_PLAN_RECIPIENT: 'test@example.com',
  PALWORLD_NEWS_RECIPIENT: 'test@example.com',
  CGV_IMAX_RECIPIENT: 'test@example.com',
  CGV_IMAX_MOVIES: '테스트:30000000',
  DISCORD_BOT_TOKEN: 'test',
  DISCORD_ERROR_WEBHOOK_URL: 'https://example.com/webhook',
  OBSERVE_APP_KEY: 'test',
  OBSERVE_APP_SECRET: 'test',
};

for (const [key, value] of Object.entries(DUMMY_ENV)) {
  process.env[key] ??= value;
}
