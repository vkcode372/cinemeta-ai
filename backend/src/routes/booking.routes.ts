import { Router } from 'express';
import { get, list } from '../controllers/booking.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeOwnResources } from '../middlewares/authorize-own-resources.js';
import { validate } from '../middlewares/validate.js';
import { uuidParamSchema } from '../validators/list.validators.js';

export const bookingRoutes = Router();
bookingRoutes.use(authenticate, authorizeOwnResources);
bookingRoutes.get('/', list);
bookingRoutes.get('/:id', validate(uuidParamSchema, 'params'), get);
