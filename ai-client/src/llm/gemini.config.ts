import 'dotenv/config';
import { z } from 'zod';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export class GeminiConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GeminiConfigurationError';
  }
}

const schema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MODEL: z.string().trim().min(1),
});

export function loadGeminiConfig(environment: NodeJS.ProcessEnv = process.env): GeminiConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new GeminiConfigurationError(`Configure GEMINI_API_KEY and GEMINI_MODEL (${missing})`);
  }
  return { apiKey: result.data.GEMINI_API_KEY, model: result.data.GEMINI_MODEL };
}
