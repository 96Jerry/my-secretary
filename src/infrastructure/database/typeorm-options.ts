import type { DataSourceOptions } from 'typeorm';

// typeorm CLI(ts-node-esm)는 tsconfig paths를 해석하지 않으므로 alias 사용 금지
import { env } from '../../config/index.js';

// ESM에선 __dirname 미지원 → import.meta.dirname 사용 (Node 20.11+).
const here = import.meta.dirname;

export const buildTypeOrmOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: env.DB_SYNCHRONIZE,
  logging: env.DB_LOGGING,
  entities: [here + '/../../**/*.orm-entity.{ts,js}'],
  migrations: [here + '/migrations/*.{ts,js}'],
});
