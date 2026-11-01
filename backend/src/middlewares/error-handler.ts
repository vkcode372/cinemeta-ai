import type { ErrorRequestHandler } from 'express';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  void _next;
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }
  if (error instanceof UniqueConstraintError) {
    res.status(409).json({ error: { message: 'A record with this value already exists' } });
    return;
  }
  if (error instanceof ValidationError) {
    res.status(400).json({ error: { message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { message: 'Invalid request', details: error.issues } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { message: 'Internal server error' } });
};
