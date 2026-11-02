import 'dotenv/config';
import { z } from 'zod';

export interface OllamaConfig { baseUrl: string; model: string }

export class OllamaConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) { super(message, options); this.name = 'OllamaConfigurationError'; }
}

const schema = z.object({
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().trim().min(1).default('llama3.1:8b'),
});

export function loadOllamaConfig(environment: NodeJS.ProcessEnv = process.env): OllamaConfig {
  const result = schema.safeParse(environment);
  if (!result.success) throw new OllamaConfigurationError(`Configure OLLAMA_BASE_URL and OLLAMA_MODEL (${result.error.issues.map((issue) => issue.path.join('.')).join(', ')})`);
  return { baseUrl: result.data.OLLAMA_BASE_URL.replace(/\/$/, ''), model: result.data.OLLAMA_MODEL };
}
