import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { _ngotPool?: Pool };

export const pool =
  globalForDb._ngotPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://ngot:ngot@localhost:5432/ngot',
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForDb._ngotPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };
