import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://ngot:ngot@localhost:5432/ngot',
  },
  strict: true,
  verbose: true,
} satisfies Config;
