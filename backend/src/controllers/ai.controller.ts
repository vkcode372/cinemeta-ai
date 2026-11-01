import type { RequestHandler } from 'express';
import * as ai from '../services/ai.service.js';
import { chatRequestSchema } from '../validators/ai.validators.js';

export const chat: RequestHandler = async (req, res, next) => {
  try {
    const input = chatRequestSchema.parse(req.body);
    if (!req.user?.id || !req.authToken) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }
    res.json(await ai.chat(req.user.id, req.authToken, input));
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(JSON.stringify({ event: 'ai_chat_request_failed', errorName }));
    next(error);
  }
};
