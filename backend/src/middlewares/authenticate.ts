import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';
import { getJwtSecret } from '../config/jwt.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const bearerToken = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  const cookieValue = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('cinemate_token='))
    ?.slice('cinemate_token='.length);
  let cookieToken: string | undefined;
  try {
    cookieToken = cookieValue ? decodeURIComponent(cookieValue) : undefined;
  } catch {
    return next(new AppError('Invalid authentication cookie', 401));
  }
  const token = bearerToken ?? cookieToken;
  if (!token) return next(new AppError('Authentication required', 401));
  const secret = getJwtSecret();
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'cinemate-api',
      audience: 'cinemate-client',
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token');
    req.user = { id: payload.sub };
    req.authToken = token;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};
