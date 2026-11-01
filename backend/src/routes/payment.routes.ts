import { Router } from 'express';
import { list } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const paymentRoutes = Router();
paymentRoutes.use(authenticate);
paymentRoutes.get('/', list);
