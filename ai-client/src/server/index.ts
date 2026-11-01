import 'dotenv/config';
import { z } from 'zod';
import { createChatApp } from './chat-app.js';

const envSchema = z.object({
  AI_CLIENT_PORT: z.coerce.number().int().positive().default(4200),
  AI_CLIENT_HOST: z.string().default('127.0.0.1'),
  AI_CLIENT_SERVICE_TOKEN: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  MCP_SERVER_URL: z.string().url(),
  AI_AGENT_MAX_ITERATIONS: z.coerce.number().int().min(1).max(12).default(5),
});
const env = envSchema.parse(process.env);
const app = createChatApp({
  jwtSecret: env.JWT_SECRET,
  serviceToken: env.AI_CLIENT_SERVICE_TOKEN,
  mcpServerUrl: env.MCP_SERVER_URL,
  maxIterations: env.AI_AGENT_MAX_ITERATIONS,
});
app.listen(env.AI_CLIENT_PORT, env.AI_CLIENT_HOST, () => {
  console.log(`AI client chat service listening at http://${env.AI_CLIENT_HOST}:${env.AI_CLIENT_PORT}`);
});
