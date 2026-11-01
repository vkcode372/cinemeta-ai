import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';

export const register: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await authService.register(req.body) }); } catch (error) { next(error); }
};
export const login: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await authService.login(req.body) }); } catch (error) { next(error); }
};
