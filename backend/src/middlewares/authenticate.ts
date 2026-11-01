import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return next(new AppError('Authentication required', 401));
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET must be set');
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token');
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};
