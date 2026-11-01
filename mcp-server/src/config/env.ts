import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  HOST: z.string().default('127.0.0.1'),
  BACKEND_BASE_URL: z.string().url().default('http://127.0.0.1:4000'),
  JWT_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
