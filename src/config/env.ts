import 'dotenv/config';

import { validateEnv } from './env.validation';

export const env = validateEnv(process.env);
