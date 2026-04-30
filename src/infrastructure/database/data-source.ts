import 'dotenv/config';
import { DataSource } from 'typeorm';

import { buildTypeOrmOptions } from './typeorm-options.js';

export default new DataSource(buildTypeOrmOptions());
