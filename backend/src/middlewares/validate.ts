import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

export const validate = (schema: ZodType, target: 'body' | 'query' | 'params' = 'body'): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) return next(new AppError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '), 400));
  if (target === 'body') req.body = result.data;
  next();
};
