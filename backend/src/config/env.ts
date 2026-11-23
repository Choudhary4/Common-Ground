import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/common-ground'),
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
  COOKIE_SECRET: z.string().min(16).default('dev-cookie-secret-change-in-production'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(72),
  SOCIAL_STATUS_TTL_MINUTES: z.coerce.number().positive().default(120),
  QR_BASE_URL: z.string().url().default('http://localhost:5173/join'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hello@commonground.local'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
