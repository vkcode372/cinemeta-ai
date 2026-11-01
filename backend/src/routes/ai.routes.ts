import { Router } from 'express';
import { chat } from '../controllers/ai.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { chatRequestSchema } from '../validators/ai.validators.js';

export const aiRoutes = Router();
aiRoutes.post('/chat', authenticate, validate(chatRequestSchema), chat);
