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
  APP_URL: process.env['APP_URL'] ?? 'http://localhost:5173',
  SMTP_HOST: process.env['SMTP_HOST'],
  SMTP_PORT: Number(process.env['SMTP_PORT'] ?? 587),
  SMTP_USER: process.env['SMTP_USER'],
  SMTP_PASS: process.env['SMTP_PASS'],
  SMTP_FROM: process.env['SMTP_FROM'] ?? 'no-reply@kaos.local',
};
