import { Router } from 'express';
import { create, get, list, seats } from '../controllers/booking.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeOwnResources } from '../middlewares/authorize-own-resources.js';
import { validate } from '../middlewares/validate.js';
import { showIdParamSchema, uuidParamSchema } from '../validators/list.validators.js';

export const bookingRoutes = Router();
bookingRoutes.use(authenticate, authorizeOwnResources);
bookingRoutes.get('/shows/:showId/seats', validate(showIdParamSchema, 'params'), seats);
bookingRoutes.post('/', create);
bookingRoutes.get('/', list);
bookingRoutes.get('/:id', validate(uuidParamSchema, 'params'), get);
