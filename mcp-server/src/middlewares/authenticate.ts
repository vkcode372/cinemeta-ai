import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

export const authenticateMcpRequest: RequestHandler = (req, _res, next) => {
  const bearerToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookieValue = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('cinemate_token='))
    ?.slice('cinemate_token='.length);
  let cookieToken: string | undefined;
  try {
    cookieToken = cookieValue ? decodeURIComponent(cookieValue) : undefined;
  } catch {
    return next(new AppError(401, 'Invalid authentication cookie'));
  }
  const token = bearerToken ?? cookieToken;
  if (!token) return next(new AppError(401, 'Bearer authentication is required'));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'cinemate-api',
      audience: 'cinemate-client',
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      return next(new AppError(401, 'Invalid authentication token'));
    }
    req.mcpPrincipal = { userId: payload.sub, token };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired authentication token'));
  }
};
