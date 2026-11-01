import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const movieQuerySchema = listQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  title: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(80).optional(),
  language: z.string().trim().max(80).optional(),
});
export const bookingQuerySchema = listQuerySchema.extend({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
});
export const uuidParamSchema = z.object({ id: z.string().uuid() });
export const bookingIdParamSchema = z.object({ bookingId: z.string().uuid() });
