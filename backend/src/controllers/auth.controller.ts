import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';

export const me: RequestHandler = async (req, res, next) => {
  if (!req.user?.id) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  try {
    res.json({ data: await authService.getPublicUser(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const register: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await authService.register(req.body) }); } catch (error) { next(error); }
};
export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.cookie('cinemate_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    // Remove cookies issued by earlier builds with Path=/api, which are not sent
    // when the browser requests private page routes such as /assistant.
    res.clearCookie('cinemate_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
    });
    res.json({ data: { user: result.user } });
  } catch (error) { next(error); }
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie('cinemate_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie('cinemate_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  });
  res.status(204).end();
};
