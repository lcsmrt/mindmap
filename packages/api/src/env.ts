import { config } from 'dotenv';
config();

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('Missing required environment variable: DATABASE_URL');
  process.exit(1);
}

export const env = {
  DATABASE_URL,
  PORT: Number(process.env['PORT'] ?? 3000),
  COOKIE_SECURE: (process.env['COOKIE_SECURE'] ?? 'false') === 'true',
};
