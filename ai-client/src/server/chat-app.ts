import express, { type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AgentRuntime } from '../agent/agent-runtime.js';
import { McpClient } from '../client/mcp-client.js';
import { McpConnectionError } from '../errors.js';
import { GeminiConfigurationError } from '../llm/gemini.config.js';
import { GeminiProvider } from '../llm/gemini.provider.js';
import { GeminiProviderError } from '../llm/gemini.provider.js';
import type { LlmInterface } from '../llm/llm.interface.js';

const requestSchema = z.object({
  userId: z.string().uuid(),
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
}).strict();

interface ConversationSession {
  accessToken: string;
  agent: AgentRuntime;
  mcp: McpClient;
  lastUsed: number;
}

export interface ChatServerConfig {
  jwtSecret: string;
  serviceToken: string;
  mcpServerUrl: string;
  maxIterations?: number;
  providerFactory?: () => LlmInterface;
}

export function createChatApp(config: ChatServerConfig) {
  const app = express();
  const sessions = new Map<string, ConversationSession>();
  app.locals.closeSessions = async () => {
    await Promise.all([...sessions.values()].map((session) => session.mcp.close().catch(() => undefined)));
    sessions.clear();
  };
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const authenticateService: RequestHandler = (req, res, next) => {
    if (!config.serviceToken || req.header('x-ai-service-token') !== config.serviceToken) {
      res.status(401).json({ error: { message: 'Unauthorized service request' } });
      return;
    }
    const token = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      res.status(401).json({ error: { message: 'Authenticated user token required' } });
      return;
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'], issuer: 'cinemate-api', audience: 'cinemate-client',
      });
      if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token subject');
      res.locals.userId = payload.sub;
      res.locals.accessToken = token;
      next();
    } catch {
      res.status(401).json({ error: { message: 'Invalid or expired authentication token' } });
    }
  };

  app.post('/internal/chat', authenticateService, async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: 'Invalid chat request', details: parsed.error.issues } });
      return;
    }
    const { userId, conversationId, message } = parsed.data;
    const verifiedUserId = res.locals.userId as string;
    if (userId !== verifiedUserId) {
      res.status(403).json({ error: { message: 'Authenticated user does not match chat owner' } });
      return;
    }

    const sessionKey = `${verifiedUserId}:${conversationId}`;
    let session = sessions.get(sessionKey);
    if (session && session.accessToken !== res.locals.accessToken) {
      await session.mcp.close();
      sessions.delete(sessionKey);
      session = undefined;
    }

    try {
      if (!session) {
        const mcp = new McpClient({ serverUrl: config.mcpServerUrl, accessToken: res.locals.accessToken as string });
        await mcp.connect();
        session = {
          accessToken: res.locals.accessToken as string,
          mcp,
          agent: new AgentRuntime(config.providerFactory?.() ?? new GeminiProvider(), mcp, { maxIterations: config.maxIterations }),
          lastUsed: Date.now(),
        };
        sessions.set(sessionKey, session);
      }
      session.lastUsed = Date.now();
      const result = await session.agent.sendMessage(message);
      res.json({ data: {
        conversationId,
        text: result.text,
        toolCalls: result.toolCalls.map(({ name }) => ({ name, status: 'completed' })),
        toolErrors: result.toolErrors.map(({ name, message: errorMessage }) => ({ name, message: errorMessage })),
        iterations: result.iterations,
      } });
    } catch (error) {
      const cause = error instanceof Error ? error : new Error('Unknown AI chat error');
      const rootCause = cause.cause instanceof Error ? cause.cause : undefined;
      const errorDetails: Record<string, unknown> = {
        event: 'ai_chat_processing_failed',
        errorName: cause.name,
        errorMessage: cause.message.slice(0, 300),
      };
      if (error instanceof McpConnectionError) errorDetails.mcpStatus = error.statusCode ?? null;
      if (error instanceof GeminiProviderError) errorDetails.geminiStatus = error.statusCode ?? null;
      if (rootCause) {
        errorDetails.causeName = rootCause.name;
        errorDetails.causeMessage = rootCause.message.slice(0, 300);
      }
      console.error(JSON.stringify(errorDetails));
      if (error instanceof McpConnectionError) {
        res.status(503).json({ error: { code: 'MCP_UNAVAILABLE', message: 'Movie tools are temporarily unavailable. Please try again soon.' } });
        return;
      }
      if (error instanceof GeminiConfigurationError) {
        res.status(503).json({ error: { code: 'GEMINI_NOT_CONFIGURED', message: 'The AI assistant is not configured right now.' } });
        return;
      }
      if (error instanceof GeminiProviderError) {
        if (error.statusCode === 429) {
          res.status(429).json({ error: { code: 'GEMINI_RATE_LIMIT', message: 'The assistant is busy. Please try again in a moment.' } });
          return;
        }
        if (error.statusCode === 401 || error.statusCode === 403) {
          res.status(503).json({ error: { code: 'GEMINI_API_KEY_INVALID', message: 'The AI assistant is temporarily unavailable.' } });
          return;
        }
        res.status(503).json({ error: { code: 'GEMINI_UNAVAILABLE', message: 'The AI service could not complete that request. Please try again.' } });
        return;
      }
      res.status(502).json({ error: { code: 'AI_CHAT_FAILED', message: 'The assistant could not complete that request. Please try again.' } });
    }
  });

  const cleanup = setInterval(() => {
    const expiry = Date.now() - 30 * 60 * 1000;
    for (const [key, session] of sessions) {
      if (session.lastUsed < expiry) {
        sessions.delete(key);
        void session.mcp.close();
      }
    }
  }, 60 * 1000);
  cleanup.unref();
  return app;
}
