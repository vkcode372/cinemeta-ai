import { z } from 'zod';

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
}).strict();
