import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config.js';
import { InitialSchema1760328000000 } from './migrations/1760328000000-initial-schema.js';

const options = databaseOptions();

export default new DataSource({
  ...options,
  migrations: [InitialSchema1760328000000],
} as ConstructorParameters<typeof DataSource>[0]);
