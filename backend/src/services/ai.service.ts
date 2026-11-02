import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

const configSchema = z.object({
  AI_CLIENT_BASE_URL: z.string().url(),
  AI_CLIENT_SERVICE_TOKEN: z.string().min(32),
});

export async function chat(
  userId: string,
  accessToken: string,
  input: { conversationId: string; message: string },
) {
  const config = configSchema.safeParse(process.env);
  if (!config.success) throw new AppError('AI assistant is not configured', 503);
  let response: Response;
  try {
    console.log(`${config.data.AI_CLIENT_BASE_URL.replace(/\/$/, '')}/internal/chat`)
    response = await fetch(`${config.data.AI_CLIENT_BASE_URL.replace(/\/$/, '')}/internal/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ai-service-token': config.data.AI_CLIENT_SERVICE_TOKEN,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ ...input, userId }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const cause = error instanceof Error ? error : new Error('Unknown network error');
    const networkCode = 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
    console.error(JSON.stringify({
      event: 'ai_client_request_failed',
      errorName: cause.name,
      errorMessage: cause.message.slice(0, 300),
      networkCode,
    }));
    throw new AppError('AI assistant service is unavailable', 502);
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const responseError = typeof payload === 'object' && payload !== null && 'error' in payload
      ? (payload as { error?: { code?: unknown } }).error
      : undefined;
    console.error(JSON.stringify({
      event: 'ai_client_returned_error',
      status: response.status,
      errorCode: typeof responseError?.code === 'string' ? responseError.code : 'UNKNOWN',
    }));
    if (response.status === 401 || response.status === 403) {
      throw new AppError('AI assistant authorization failed', response.status);
    }
    if (response.status === 400) throw new AppError('Invalid AI assistant request', 400);
    const publicMessages: Record<string, { message: string; status: number }> = {
      MCP_UNAVAILABLE: { message: 'Movie search and booking tools are temporarily unavailable. Please try again soon.', status: 503 },
      GEMINI_NOT_CONFIGURED: { message: 'The AI assistant is not configured right now.', status: 503 },
      GEMINI_API_KEY_INVALID: { message: 'The AI assistant is temporarily unavailable.', status: 503 },
      GEMINI_UNAVAILABLE: { message: 'The AI service could not complete that request. Please try again.', status: 503 },
      GEMINI_RATE_LIMIT: { message: 'The assistant is busy. Please try again in a moment.', status: 429 },
      AI_CHAT_FAILED: { message: 'The assistant could not complete that request. Please try again.', status: 502 },
    };
    const safeError = typeof responseError?.code === 'string' ? publicMessages[responseError.code] : undefined;
    if (safeError) throw new AppError(safeError.message, safeError.status);
    throw new AppError('AI assistant service is unavailable. Please try again soon.', response.status >= 500 ? 502 : 400);
  }
  return payload;
}
