import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { listQuerySchema } from '../validators/list.validators.js';
import * as catalog from '../services/catalog.service.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { page, limit } = listQuerySchema.parse(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(await catalog.listMovies(page, limit, search));
  } catch (error) { next(error); }
};
export const get: RequestHandler = async (req, res, next) => {
  try {
    const movie = await catalog.getMovie(String(req.params.id));
    if (!movie) throw new AppError('Movie not found', 404);
    res.json({ data: movie });
  } catch (error) { next(error); }
};
