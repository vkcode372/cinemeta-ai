import { Router } from 'express';
import { bookingStatus, list } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorizeOwnResources } from '../middlewares/authorize-own-resources.js';

export const paymentRoutes = Router();
paymentRoutes.use(authenticate, authorizeOwnResources);
paymentRoutes.get('/bookings/:bookingId/status', bookingStatus);
paymentRoutes.get('/', list);
