import { Router } from 'express';
import { get, list } from '../controllers/movie.controller.js';
import { validate } from '../middlewares/validate.js';
import { uuidParamSchema } from '../validators/list.validators.js';

export const movieRoutes = Router();
movieRoutes.get('/', list);
movieRoutes.get('/:id', validate(uuidParamSchema, 'params'), get);
