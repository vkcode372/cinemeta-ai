import { Router } from 'express';
import { get, list } from '../controllers/booking.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { uuidParamSchema } from '../validators/list.validators.js';

export const bookingRoutes = Router();
bookingRoutes.use(authenticate);
bookingRoutes.get('/', list);
bookingRoutes.get('/:id', validate(uuidParamSchema, 'params'), get);
