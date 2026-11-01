import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

// Private resource routes must have a verified principal before using its ID as the owner scope.
export const authorizeOwnResources: RequestHandler = (req, _res, next) => {
  if (!req.user?.id) return next(new AppError('Forbidden', 403));
  next();
};
